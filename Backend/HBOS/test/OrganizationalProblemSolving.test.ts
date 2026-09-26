import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { OrganizationalProblemSolvingService } from "../Product/OrganizationalProblemSolvingService";
import type { BaselineMetrics, PostInterventionMetrics, ExpectedImpact } from "../Product/ImpactMeasurementService";
import { SecurityContext } from "../Security/SecurityContext";
import { Principal } from "../Security/Principals";
import { Authorization } from "../Security/Authorization";
import { GovernanceEngine } from "../Engines/GovernanceEngine";

const TENANT = "tenant-problem-1";
const OTHER_TENANT = "tenant-problem-2";

const makeContext = (tenantId: string = TENANT): SecurityContext => SecurityContext.forHumanUser(
    Principal.humanUser("actor-1", tenantId),
    [Authorization.READ, Authorization.WRITE, Authorization.EXECUTE, Authorization.APPROVE, Authorization.ACCESS_EVIDENCE, Authorization.ADMINISTER],
);

const baseline = (tenantId: string = TENANT): BaselineMetrics => ({
    tenantId,
    revenue: 1000,
    profit: 200,
    profitMargin: 0.2,
    debtRatio: 0.4,
    cycleTime: 100,
    throughput: 10,
    errorRate: 5,
    capacity: 100,
    operatingCost: 1000,
    decisionLatency: 50,
    riskScore: 20,
    recordedAt: "2026-01-01T00:00:00Z",
});

const post = (tenantId: string = TENANT): PostInterventionMetrics => ({
    tenantId,
    revenue: 1200,
    profit: 320,
    profitMargin: 0.267,
    debtRatio: 0.35,
    cycleTime: 80,
    throughput: 12,
    errorRate: 3,
    capacity: 120,
    operatingCost: 800,
    decisionLatency: 30,
    riskScore: 15,
    recordedAt: "2026-02-01T00:00:00Z",
});

const expectedImpact: ExpectedImpact = {
    timeSaved: 20,
    costReduced: 200,
    capacityRelease: 20,
    qualityImprovement: 2,
    riskReduction: 5,
    financialValue: 500,
    roi: 0.5,
};

const openAndDefine = async (service: OrganizationalProblemSolvingService, tenantId: string = TENANT) => {
    const opened = await service.openCase({
        tenantId,
        title: "Procurement approvals are too slow",
        scope: "procurement approvals",
        category: "PROCESS",
        severity: "HIGH",
        createdBy: "actor-1",
    });
    expect(opened.status).toBe("READY");
    if (opened.status !== "READY") throw new Error("open failed");
    const caseId = opened.value.id;

    const defined = await service.defineProblem(tenantId, caseId, "actor-1", {
        statement: "Procurement approvals take too long and block operations",
        impactedProcesses: ["Procurement", "Finance"],
        successCriteria: ["Cycle time below 3 days"],
    });
    expect(defined.status).toBe("READY");
    if (defined.status !== "READY") throw new Error("define failed");
    expect(defined.value.stage).toBe("DEFINED");
    return caseId;
};

const addEvidence = async (service: OrganizationalProblemSolvingService, caseId: string, tenantId: string = TENANT) => {
    const evidenced = await service.addEvidence(tenantId, caseId, "actor-1", [
        { category: "DELAY", summary: "Average approval takes 9 days", source: "ERP report" },
        { category: "PROCESS", summary: "Three sequential approval stages", source: "Process map" },
        { category: "PEOPLE", summary: "Two approvers frequently unavailable", source: "HR roster" },
        { category: "DATA", summary: "No SLA tracking exists", source: "Internal audit note" },
    ]);
    expect(evidenced.status).toBe("READY");
    if (evidenced.status !== "READY") throw new Error("evidence failed");
    expect(evidenced.value.stage).toBe("EVIDENCE_SET");
    expect(evidenced.value.evidenceCompleteness).toBe(1);
    return evidenced.value;
};

const reachOptions = async (service: OrganizationalProblemSolvingService, caseId: string, tenantId: string = TENANT) => {
    const hypotheses = await service.formHypotheses(tenantId, caseId, "actor-1");
    expect(hypotheses.status).toBe("READY");
    if (hypotheses.status !== "READY") throw new Error("hypotheses failed");
    expect(hypotheses.value.stage).toBe("HYPOTHESES_FORMED");
    expect(hypotheses.value.hypotheses.length).toBeGreaterThan(0);
    expect(hypotheses.value.diagnosis?.reasoningTraceId).toMatch(/^TRACE-/);

    const root = await service.analyzeRootCause(tenantId, caseId, "actor-1");
    expect(root.status).toBe("READY");
    if (root.status !== "READY") throw new Error("root cause failed");
    expect(root.value.stage).toBe("ROOT_CAUSE_IDENTIFIED");
    expect(root.value.rootCause?.primaryCause).toBeTruthy();

    const options = await service.evaluateOptions(tenantId, caseId, "actor-1", [
        { id: "opt-a", description: "Run approval stages in parallel", expectedImpact: "Faster cycle time" },
        { id: "opt-b", description: "Delegate low-value approvals to budget owners" },
    ]);
    expect(options.status).toBe("READY");
    if (options.status !== "READY") throw new Error("options failed");
    expect(options.value.stage).toBe("OPTIONS_EVALUATED");
    expect(options.value.optionEvaluation?.reasoningTraceId).toMatch(/^TRACE-/);
    return options.value;
};

describe("Organizational Problem-Solving Intelligence (canonical owner)", () => {
    let dir: string;
    let persistence: SQLitePersistenceStore;
    let service: OrganizationalProblemSolvingService;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), "hos-problem-"));
        persistence = new SQLitePersistenceStore({ databasePath: join(dir, "problems.sqlite") });
        service = new OrganizationalProblemSolvingService(persistence);
    });

    afterEach(() => {
        try { persistence.close(); } catch { /* already closed */ }
        rmSync(dir, { recursive: true, force: true });
    });

    test("runs the complete lifecycle with real engine handoffs and real metrics", async () => {
        const caseId = await openAndDefine(service);
        await addEvidence(service, caseId);
        await reachOptions(service, caseId);

        const decided = await service.decide(TENANT, caseId, "actor-1", { selectedOptionId: "opt-a", rationale: "parallel stages cut elapsed time" }, makeContext());
        expect(decided.status).toBe("READY");
        if (decided.status !== "READY") throw new Error("decide failed");
        expect(decided.value.decision?.governanceStatus).toBe("ALLOWED");

        const planned = await service.planActions(TENANT, caseId, "actor-1", {
            objective: "Parallelize procurement approvals",
            steps: ["redesign approval stages", "publish new SLA"],
            requiredApprovals: ["human-approver"],
        });
        expect(planned.status).toBe("READY");
        if (planned.status !== "READY") throw new Error("plan failed");
        expect(planned.value.actionPlan?.steps.length).toBeGreaterThan(0);

        const executed = await service.executeActions(TENANT, caseId, "actor-1", makeContext());
        expect(executed.status).toBe("READY");
        if (executed.status !== "READY") throw new Error("execute failed");
        expect(executed.value.execution?.status).toBe("EXECUTED");

        const outcome = await service.measureOutcome(TENANT, caseId, "actor-1", {
            baseline: baseline(),
            post: post(),
            expected: expectedImpact,
        });
        expect(outcome.status).toBe("READY");
        if (outcome.status !== "READY") throw new Error("outcome failed");
        expect(outcome.value.outcome?.actionOutcome).toBe("SUCCESS");
        expect(outcome.value.outcome?.outcomeAttainment).toBeGreaterThan(0);
        expect(outcome.value.outcome?.executivePerformance?.achievementRate).toBeGreaterThan(0);

        const learned = await service.captureLearning(TENANT, caseId, "actor-1");
        expect(learned.status).toBe("READY");
        if (learned.status !== "READY") throw new Error("learning failed");
        expect(learned.value.stage).toBe("LEARNED");
        expect(learned.value.knowledge?.knowledgeId).toBeTruthy();

        const metrics = await service.getMetrics(TENANT, caseId);
        expect(metrics).not.toBeNull();
        expect(metrics!.stage).toBe("LEARNED");
        expect(metrics!.evidenceCompleteness).toBe(1);
        expect(metrics!.recurrenceCount).toBe(0);
        expect(metrics!.timeToResolutionMs).not.toBeNull();
        expect(metrics!.diagnosisTimeMs).not.toBeNull();
        expect(metrics!.futureResolutionSpeedMs).toBeNull();
    }, 120000);

    test("persists cases across a store restart under tenant scope", async () => {
        const caseId = await openAndDefine(service);
        persistence.close();

        const reopened = new SQLitePersistenceStore({ databasePath: join(dir, "problems.sqlite") });
        try {
            const restarted = new OrganizationalProblemSolvingService(reopened);
            const loaded = await restarted.getCase(TENANT, caseId);
            expect(loaded).not.toBeNull();
            expect(loaded!.stage).toBe("DEFINED");
            expect(loaded!.tenantId).toBe(TENANT);

            const evidenced = await restarted.addEvidence(TENANT, caseId, "actor-1", [
                { category: "PROCESS", summary: "Sequential approvals", source: "map" },
                { category: "PEOPLE", summary: "Approver bottleneck", source: "interview" },
                { category: "DATA", summary: "No SLA", source: "audit" },
            ]);
            expect(evidenced.status).toBe("READY");
            if (evidenced.status !== "READY") throw new Error("evidence failed");
            expect(evidenced.value.stage).toBe("EVIDENCE_SET");

            const list = await restarted.listCases(TENANT, 50, 0);
            expect(list.total).toBe(1);
            expect(list.cases[0].id).toBe(caseId);
        } finally {
            reopened.close();
        }
    }, 30000);

    test("fails closed on out-of-order lifecycle transitions", async () => {
        const opened = await service.openCase({ tenantId: TENANT, title: "Out-of-order", createdBy: "actor-1" });
        if (opened.status !== "READY") throw new Error("open failed");
        const caseId = opened.value.id;

        const evidenceTooEarly = await service.addEvidence(TENANT, caseId, "actor-1", [{ category: "PROCESS", summary: "x", source: "y" }]);
        expect(evidenceTooEarly.status).toBe("BLOCKED");
        if (evidenceTooEarly.status !== "BLOCKED") throw new Error("expected BLOCKED");
        expect(evidenceTooEarly.code).toBe("problem-stage-invalid");

        const hypothesesTooEarly = await service.formHypotheses(TENANT, caseId, "actor-1");
        expect(hypothesesTooEarly.status).toBe("BLOCKED");

        const decideTooEarly = await service.decide(TENANT, caseId, "actor-1", { selectedOptionId: "x", rationale: "y" }, makeContext());
        expect(decideTooEarly.status).toBe("BLOCKED");
    }, 30000);

    test("enforces tenant isolation for reads and mutations", async () => {
        const caseId = await openAndDefine(service);

        expect(await service.getCase(OTHER_TENANT, caseId)).toBeNull();

        const crossTenant = await service.defineProblem(OTHER_TENANT, caseId, "actor-1", { statement: "hijack" });
        expect(crossTenant.status).toBe("BLOCKED");
        if (crossTenant.status !== "BLOCKED") throw new Error("expected BLOCKED");
        expect(crossTenant.code).toBe("problem-not-found");

        const otherList = await service.listCases(OTHER_TENANT, 50, 0);
        expect(otherList.total).toBe(0);
    }, 30000);

    test("blocks a decision the governance owner denies", async () => {
        const governance = new GovernanceEngine();
        governance.addPolicy({
            id: "deny-procurement-decision",
            description: "Deny procurement decisions in this test",
            match: () => ({ matched: true }),
            evaluate: () => ({ effect: "DENY", reason: "policy denies" }),
        });
        const governed = new OrganizationalProblemSolvingService(persistence, { governance });

        const caseId = await openAndDefine(governed);
        await addEvidence(governed, caseId);
        await reachOptions(governed, caseId);

        const decided = await governed.decide(TENANT, caseId, "actor-1", { selectedOptionId: "opt-a", rationale: "x" }, makeContext());
        expect(decided.status).toBe("BLOCKED");
        if (decided.status !== "BLOCKED") throw new Error("expected BLOCKED");
        expect(decided.code).toBe("problem-governance-denied");

        const persisted = await governed.getCase(TENANT, caseId);
        expect(persisted!.stage).toBe("OPTIONS_EVALUATED");
    }, 120000);

    test("requires human approval when governance demands review", async () => {
        const governance = new GovernanceEngine();
        governance.addPolicy({
            id: "review-procurement-decision",
            description: "Review procurement decisions in this test",
            match: () => ({ matched: true }),
            evaluate: () => ({ effect: "REVIEW_REQUIRED", reason: "needs review", requiresHumanApproval: true }),
        });
        const governed = new OrganizationalProblemSolvingService(persistence, { governance });

        const caseId = await openAndDefine(governed);
        await addEvidence(governed, caseId);
        await reachOptions(governed, caseId);

        const pending = await governed.decide(TENANT, caseId, "actor-1", { selectedOptionId: "opt-a", rationale: "x" }, makeContext());
        expect(pending.status).toBe("BLOCKED");
        if (pending.status !== "BLOCKED") throw new Error("expected BLOCKED");
        expect(pending.code).toBe("problem-governance-approval-required");
        expect((await governed.getCase(TENANT, caseId))!.stage).toBe("DECISION_PENDING_APPROVAL");

        const approved = await governed.decide(TENANT, caseId, "actor-1", { selectedOptionId: "opt-a", rationale: "x", humanApprovalRef: "APPROVAL-42" }, makeContext());
        expect(approved.status).toBe("READY");
        if (approved.status !== "READY") throw new Error("expected READY");
        expect(approved.value.decision?.humanApprovalRef).toBe("APPROVAL-42");
        expect(approved.value.stage).toBe("DECIDED");
    }, 120000);

    test("recovers a persisted action plan after the engine process restarts", async () => {
        const caseId = await openAndDefine(service);
        await addEvidence(service, caseId);
        await reachOptions(service, caseId);

        const decided = await service.decide(TENANT, caseId, "actor-1", { selectedOptionId: "opt-b", rationale: "delegate" }, makeContext());
        expect(decided.status).toBe("READY");
        const planned = await service.planActions(TENANT, caseId, "actor-1", {
            objective: "Delegate low-value approvals",
            steps: ["define delegation thresholds"],
            requiredApprovals: ["human-approver"],
        });
        expect(planned.status).toBe("READY");

        // New service instance over the same persisted case simulates a process
        // restart: the AutonomousOperationsEngine no longer holds the workflow.
        const restarted = new OrganizationalProblemSolvingService(persistence);
        const executed = await restarted.executeActions(TENANT, caseId, "actor-1", makeContext());
        expect(executed.status).toBe("READY");
        if (executed.status !== "READY") throw new Error("execute failed");
        expect(executed.value.stage).toBe("EXECUTED");
        expect(executed.value.execution?.status).toBe("EXECUTED");
    }, 120000);

    test("rejects outcome metrics that belong to another tenant", async () => {
        const caseId = await openAndDefine(service);
        await addEvidence(service, caseId);
        await reachOptions(service, caseId);
        await service.decide(TENANT, caseId, "actor-1", { selectedOptionId: "opt-a", rationale: "x" }, makeContext());
        await service.planActions(TENANT, caseId, "actor-1", { objective: "fix", steps: ["s"], requiredApprovals: ["human-approver"] });
        await service.executeActions(TENANT, caseId, "actor-1", makeContext());

        const crossTenant = await service.measureOutcome(TENANT, caseId, "actor-1", {
            baseline: baseline(OTHER_TENANT),
            post: post(OTHER_TENANT),
        });
        expect(crossTenant.status).toBe("BLOCKED");
        if (crossTenant.status !== "BLOCKED") throw new Error("expected BLOCKED");
        expect(crossTenant.code).toBe("problem-outcome-tenant-mismatch");
    }, 120000);
});
