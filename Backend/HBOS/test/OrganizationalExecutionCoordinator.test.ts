import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OrganizationalExecutionCoordinator, DEFAULT_DECISION_ARTIFACT_KEY } from "../Product/OrganizationalExecutionCoordinator";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { Authorization } from "../Security/Authorization";
import { Principal } from "../Security/Principals";
import { SecurityContext } from "../Security/SecurityContext";

const OWNER_PERMISSIONS = [
    Authorization.READ,
    Authorization.WRITE,
    Authorization.EXECUTE,
    Authorization.APPROVE,
    Authorization.ACCESS_EVIDENCE,
    Authorization.ADMINISTER
];
const EXECUTOR_PERMISSIONS = [Authorization.READ, Authorization.WRITE, Authorization.EXECUTE, Authorization.ACCESS_EVIDENCE];
const VIEWER_PERMISSIONS = [Authorization.READ];

const humanContext = (actorId: string, tenantId: string, permissions: Authorization[]): SecurityContext =>
    SecurityContext.forHumanUser(Principal.humanUser(actorId, tenantId), permissions, `trace:${actorId}`);

const store = () => new SQLitePersistenceStore({ databasePath: ":memory:" });

async function seedDecision(persistence: SQLitePersistenceStore, tenantId: string): Promise<void> {
    await persistence.write({ tenantId }, DEFAULT_DECISION_ARTIFACT_KEY, {
        status: "READY",
        tenantId,
        problem: "choose expansion plan",
        method: "EXPERT_CHOICE",
        weightsSource: "AHP",
        recommendation: { alternative: "Alpha" }
    });
}

async function proposeReady(coordinator: OrganizationalExecutionCoordinator, context: SecurityContext, title = "Execute expansion") {
    const result = await coordinator.propose(context, { title, description: "governed execution" });
    expect(result.status).toBe("READY");
    return result.workItem!;
}

describe("OrganizationalExecutionCoordinator", () => {
    it("exposes the canonical product boundary", () => {
        const service = new OrganizationalExecutionCoordinator();
        expect(service.capabilityId).toBe("product.organizational-execution");
        expect(service.targetEngine).toBe("Organizational Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new OrganizationalExecutionCoordinator().execute("continue").status).toBe("READY");
        expect(new OrganizationalExecutionCoordinator().execute(" ").status).toBe("BLOCKED");
    });

    it("fails closed without a persisted decision artifact", async () => {
        const persistence = store();
        const coordinator = new OrganizationalExecutionCoordinator(persistence);
        const owner = humanContext("owner", "tenant:a", OWNER_PERMISSIONS);

        const result = await coordinator.propose(owner, { title: "No decision yet" });
        expect(result.status).toBe("BLOCKED");
        expect(result.code).toBe("DECISION_REQUIRED");
        expect(result.workItem).toBeUndefined();
    });

    it("drives the full governed chain: propose → approve → assign → start → complete", async () => {
        const persistence = store();
        const coordinator = new OrganizationalExecutionCoordinator(persistence);
        const owner = humanContext("owner", "tenant:a", OWNER_PERMISSIONS);
        const manager = humanContext("manager", "tenant:a", OWNER_PERMISSIONS);
        await seedDecision(persistence, "tenant:a");

        const proposed = await proposeReady(coordinator, owner);
        expect(proposed.status).toBe("AWAITING_APPROVAL");
        expect(proposed.decision.recommendation).toBe("Alpha");
        expect(proposed.history).toHaveLength(1);

        const approved = await coordinator.approve(manager, proposed.workItemId, { comments: "approved for execution" });
        expect(approved.status).toBe("READY");
        expect(approved.workItem!.status).toBe("APPROVED");
        expect(approved.workItem!.approval?.approvedBy).toBe("manager");
        expect(approved.workItem!.approval?.authority).toBe("APPROVE");
        expect(approved.workItem!.approval?.tenantId).toBe("tenant:a");
        expect(approved.workItem!.approval?.decisionArtifactKey).toBe(DEFAULT_DECISION_ARTIFACT_KEY);
        expect(approved.workItem!.workflow?.status).toBe("READY");
        expect(approved.workItem!.workflow?.steps.length).toBeGreaterThan(0);

        const assigned = await coordinator.assign(manager, proposed.workItemId, {
            assigneeId: "operator-1",
            dueDate: "2026-10-01T00:00:00.000Z"
        });
        expect(assigned.status).toBe("READY");
        expect(assigned.workItem!.status).toBe("ASSIGNED");
        expect(assigned.workItem!.assignment?.assigneeId).toBe("operator-1");
        expect(assigned.workItem!.dueDate).toBe("2026-10-01T00:00:00.000Z");

        const started = await coordinator.start(manager, proposed.workItemId);
        expect(started.status).toBe("READY");
        expect(started.workItem!.status).toBe("IN_PROGRESS");

        const completed = await coordinator.complete(manager, proposed.workItemId, {
            kpi: { metric: "revenue", target: 1000, actual: 1100, unit: "IRR", series: [800, 950, 1100] },
            evidence: [{ id: "EV-1", type: "RECEIPT", description: "signed execution memo", sha256: "a".repeat(64) }],
            feedback: {
                result: "DELIVERED",
                notes: "completed on time",
                metrics: {
                    before: { cycleTime: 10, throughput: 50, errorRate: 0.1, capacity: 100, cost: 500 },
                    after: { cycleTime: 8, throughput: 60, errorRate: 0.05, capacity: 120, cost: 450 }
                }
            }
        });
        expect(completed.status).toBe("READY");
        const item = completed.workItem!;
        expect(item.status).toBe("COMPLETED");
        expect(item.kpi?.status).toBe("ABOVE_TARGET");
        expect(item.kpi?.achievementRate).toBeCloseTo(1.1, 6);
        expect(item.kpi?.trend?.direction).toBe("UP");
        expect(item.evidence).toHaveLength(1);
        expect(item.feedback?.result).toBe("DELIVERED");
        expect(item.feedback?.learning?.actualFinancialValue).toBeGreaterThan(0);
        expect(item.history.map((event) => event.to)).toEqual([
            "AWAITING_APPROVAL",
            "APPROVED",
            "ASSIGNED",
            "IN_PROGRESS",
            "COMPLETED"
        ]);
        expect(item.provenance.verificationStatus).toBe("VERIFIED");
    });

    it("separates proposal authority (EXECUTE) from approval authority (APPROVE)", async () => {
        const persistence = store();
        const coordinator = new OrganizationalExecutionCoordinator(persistence);
        const executor = humanContext("executor", "tenant:a", EXECUTOR_PERMISSIONS);
        const viewer = humanContext("viewer", "tenant:a", VIEWER_PERMISSIONS);
        await seedDecision(persistence, "tenant:a");

        const proposed = await proposeReady(coordinator, executor);

        const deniedApproval = await coordinator.approve(executor, proposed.workItemId);
        expect(deniedApproval.status).toBe("BLOCKED");
        expect(deniedApproval.code).toBe("GOVERNANCE");

        const deniedProposal = await coordinator.propose(viewer, { title: "not allowed" });
        expect(deniedProposal.status).toBe("BLOCKED");
        expect(deniedProposal.code).toBe("FORBIDDEN");
    });

    it("never allows an autonomous principal to simulate human approval", async () => {
        const persistence = store();
        const coordinator = new OrganizationalExecutionCoordinator(persistence);
        const owner = humanContext("owner", "tenant:a", OWNER_PERMISSIONS);
        await seedDecision(persistence, "tenant:a");
        const proposed = await proposeReady(coordinator, owner);

        const autonomous = SecurityContext.forAutonomousOperation(
            Principal.autonomousOperation("daemon", "AutonomousDaemon", "tenant:a"),
            "trace:daemon"
        );
        const result = await coordinator.approve(autonomous, proposed.workItemId);
        expect(result.status).toBe("BLOCKED");
        expect(result.code).toBe("FORBIDDEN");
        expect(result.reason).toContain("autonomous-principal");
    });

    it("fails closed on invalid transitions and unapproved completion", async () => {
        const persistence = store();
        const coordinator = new OrganizationalExecutionCoordinator(persistence);
        const owner = humanContext("owner", "tenant:a", OWNER_PERMISSIONS);
        await seedDecision(persistence, "tenant:a");
        const proposed = await proposeReady(coordinator, owner);

        const earlyComplete = await coordinator.complete(owner, proposed.workItemId, {});
        expect(earlyComplete.status).toBe("BLOCKED");
        expect(earlyComplete.code).toBe("INVALID_TRANSITION");

        await coordinator.approve(owner, proposed.workItemId);
        const doubleApprove = await coordinator.approve(owner, proposed.workItemId);
        expect(doubleApprove.status).toBe("BLOCKED");
        expect(doubleApprove.code).toBe("INVALID_TRANSITION");
    });

    it("rejects a pending work item through the approval authority", async () => {
        const persistence = store();
        const coordinator = new OrganizationalExecutionCoordinator(persistence);
        const owner = humanContext("owner", "tenant:a", OWNER_PERMISSIONS);
        await seedDecision(persistence, "tenant:a");
        const proposed = await proposeReady(coordinator, owner);

        const rejected = await coordinator.reject(owner, proposed.workItemId, { reason: "not this quarter" });
        expect(rejected.status).toBe("READY");
        expect(rejected.workItem!.status).toBe("REJECTED");
        expect(rejected.workItem!.rejection?.reason).toBe("not this quarter");
        expect(rejected.workItem!.approval).toBeNull();
    });

    it("enforces tenant isolation on work-item retrieval", async () => {
        const persistence = store();
        const coordinator = new OrganizationalExecutionCoordinator(persistence);
        const ownerA = humanContext("owner-a", "tenant:a", OWNER_PERMISSIONS);
        const ownerB = humanContext("owner-b", "tenant:b", OWNER_PERMISSIONS);
        await seedDecision(persistence, "tenant:a");
        const proposed = await proposeReady(coordinator, ownerA);

        expect(await coordinator.getWorkItem(ownerB, proposed.workItemId)).toBeNull();
        expect(await coordinator.listWorkItems(ownerB)).toHaveLength(0);

        const updatedByB = await coordinator.approve(ownerB, proposed.workItemId);
        expect(updatedByB.status).toBe("BLOCKED");
        expect(updatedByB.code).toBe("NOT_FOUND");
    });

    it("persists work items durably across coordinator instances", async () => {
        const directory = mkdtempSync(join(tmpdir(), "hooshyar-execution-"));
        const databasePath = join(directory, "execution.sqlite");
        try {
            const first = new SQLitePersistenceStore({ databasePath });
            const coordinator = new OrganizationalExecutionCoordinator(first);
            const owner = humanContext("owner", "tenant:a", OWNER_PERMISSIONS);
            await seedDecision(first, "tenant:a");
            const proposed = await proposeReady(coordinator, owner);
            await coordinator.approve(owner, proposed.workItemId);
            first.close();

            const second = new SQLitePersistenceStore({ databasePath });
            const reopened = new OrganizationalExecutionCoordinator(second);
            const reloaded = await reopened.getWorkItem(owner, proposed.workItemId);
            expect(reloaded).not.toBeNull();
            expect(reloaded!.status).toBe("APPROVED");
            expect(reloaded!.approval?.approvedBy).toBe("owner");
            const listed = await reopened.listWorkItems(owner);
            expect(listed.map((item) => item.workItemId)).toContain(proposed.workItemId);
            second.close();
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    });
});
