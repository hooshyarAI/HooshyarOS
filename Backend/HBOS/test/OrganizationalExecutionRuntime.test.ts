import { Server } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const DECISION_BODY = {
    problem: "choose expansion plan",
    alternatives: ["Alpha", "Beta"],
    criteria: [
        { name: "profit", weight: 0.6, direction: "benefit" },
        { name: "risk", weight: 0.4, direction: "cost" },
    ],
    scores: [
        [8, 4],
        [6, 3],
    ],
};

const request = async (server: Server, path: string, options: RequestInit = {}) => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server-not-listening");
    return fetch(`http://127.0.0.1:${address.port}${path}`, options);
};

const cookieFrom = (response: Response): string => {
    const cookie = response.headers.get("set-cookie");
    if (!cookie) throw new Error("session-cookie-missing");
    return cookie.split(";")[0];
};

describe("product.organizational-execution — commercial runtime path", () => {
    let server: Server;
    let clock: number;

    beforeEach(async () => {
        clock = 1_900_000_000_000;
        server = createCommercialRuntimeServer({
            databasePath: ":memory:",
            now: () => clock,
            reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true, answer: "verified" }) },
        });
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    });

    afterEach(async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    const register = (username: string, organization: string) =>
        request(server, "/api/auth/register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username, password: "Sup3rSecret!", organization }),
        });

    // The governed chain performs several consequential mutations; advance the
    // injected clock so the production token-bucket refills naturally instead of
    // weakening the rate limit.
    const tick = () => { clock += 1000; };

    const jsonPost = (path: string, cookie: string, body: unknown) => {
        tick();
        return request(server, path, {
            method: "POST",
            headers: { "content-type": "application/json", cookie },
            body: JSON.stringify(body),
        });
    };

    const createDecision = (cookie: string) => jsonPost("/api/decision/workbench", cookie, DECISION_BODY);

    const propose = (cookie: string, title = "Execute expansion plan") =>
        jsonPost("/api/execution/work-items", cookie, { title, description: "governed execution from decision" });

    test("drives decision → approval → workflow → assignment → KPI/outcome → evidence → feedback over HTTP", async () => {
        const owner = await register("owner", "Acme");
        const cookie = cookieFrom(owner);

        const decision = await createDecision(cookie);
        expect(decision.status).toBe(200);

        const proposedResponse = await propose(cookie);
        expect(proposedResponse.status).toBe(200);
        const proposed = await proposedResponse.json();
        expect(proposed.status).toBe("AWAITING_APPROVAL");
        expect(proposed.decision.recommendation).toBe("Alpha");
        expect(proposed.decision.key).toBe("decision-workbench:latest");
        expect(proposed.approval).toBeNull();
        expect(proposed.provenance.verificationStatus).toBe("VERIFIED");
        expect(proposed.history).toHaveLength(1);

        const workItemId = proposed.workItemId as string;

        const approvedResponse = await jsonPost(`/api/execution/work-items/${encodeURIComponent(workItemId)}/approve`, cookie, { comments: "approved" });
        expect(approvedResponse.status).toBe(200);
        const approved = await approvedResponse.json();
        expect(approved.status).toBe("APPROVED");
        expect(approved.approval.approvedBy).toBeTruthy();
        expect(approved.approval.authority).toBe("APPROVE");
        expect(approved.approval.tenantId).toBe(proposed.tenantId);
        expect(approved.approval.decisionArtifactKey).toBe("decision-workbench:latest");
        expect(approved.approval.governanceTraceId).toBeTruthy();
        expect(approved.workflow.status).toBe("READY");
        expect(approved.workflow.steps.length).toBeGreaterThan(0);

        const assignedResponse = await jsonPost(`/api/execution/work-items/${encodeURIComponent(workItemId)}/assign`, cookie, {
            assigneeId: "ops-lead",
            dueDate: "2026-10-15T00:00:00.000Z",
        });
        expect(assignedResponse.status).toBe(200);
        const assigned = await assignedResponse.json();
        expect(assigned.status).toBe("ASSIGNED");
        expect(assigned.assignment.assigneeId).toBe("ops-lead");
        expect(assigned.dueDate).toBe("2026-10-15T00:00:00.000Z");

        const startedResponse = await jsonPost(`/api/execution/work-items/${encodeURIComponent(workItemId)}/start`, cookie, {});
        expect(startedResponse.status).toBe(200);
        expect((await startedResponse.json()).status).toBe("IN_PROGRESS");

        const completedResponse = await jsonPost(`/api/execution/work-items/${encodeURIComponent(workItemId)}/complete`, cookie, {
            kpi: { metric: "revenue", target: 1000, actual: 1150, unit: "IRR", series: [800, 950, 1150] },
            evidence: [{ id: "EV-1", type: "EXECUTION_MEMO", description: "signed memo", sha256: "b".repeat(64) }],
            feedback: {
                result: "DELIVERED",
                notes: "delivered ahead of due date",
                metrics: {
                    before: { cycleTime: 10, throughput: 50, errorRate: 0.1, capacity: 100, cost: 500 },
                    after: { cycleTime: 8, throughput: 62, errorRate: 0.05, capacity: 120, cost: 450 },
                },
            },
        });
        expect(completedResponse.status).toBe(200);
        const completed = await completedResponse.json();
        expect(completed.status).toBe("COMPLETED");
        expect(completed.kpi.status).toBe("ABOVE_TARGET");
        expect(completed.kpi.trend.direction).toBe("UP");
        expect(completed.evidence).toHaveLength(1);
        expect(completed.feedback.result).toBe("DELIVERED");
        expect(completed.feedback.learning.provenance.verificationStatus).toBe("VERIFIED");
        expect(completed.history.map((event: { to: string }) => event.to)).toEqual([
            "AWAITING_APPROVAL",
            "APPROVED",
            "ASSIGNED",
            "IN_PROGRESS",
            "COMPLETED",
        ]);

        const listResponse = await request(server, "/api/execution/work-items", { headers: { cookie } });
        expect(listResponse.status).toBe(200);
        const list = await listResponse.json();
        expect(list.workItems.map((item: { workItemId: string }) => item.workItemId)).toContain(workItemId);

        const getResponse = await request(server, `/api/execution/work-items/${encodeURIComponent(workItemId)}`, { headers: { cookie } });
        expect(getResponse.status).toBe(200);
        expect((await getResponse.json()).status).toBe("COMPLETED");
    });

    test("enforces RBAC: viewer cannot propose or approve, unauthenticated is rejected", async () => {
        const owner = await register("owner", "Acme");
        const ownerCookie = cookieFrom(owner);
        const viewer = await register("viewer", "Acme");
        const viewerCookie = cookieFrom(viewer);

        const decision = await createDecision(ownerCookie);
        expect(decision.status).toBe(200);

        const viewerPropose = await propose(viewerCookie);
        expect(viewerPropose.status).toBe(403);
        expect((await viewerPropose.json()).error).toBe("INSUFFICIENT_PERMISSIONS");

        const ownerPropose = await propose(ownerCookie);
        expect(ownerPropose.status).toBe(200);
        const workItemId = (await ownerPropose.json()).workItemId as string;

        const viewerApprove = await jsonPost(`/api/execution/work-items/${encodeURIComponent(workItemId)}/approve`, viewerCookie, {});
        expect(viewerApprove.status).toBe(403);
        expect((await viewerApprove.json()).error).toBe("INSUFFICIENT_PERMISSIONS");

        const anonymous = await request(server, "/api/execution/work-items", { method: "GET" });
        expect(anonymous.status).toBe(401);
    });

    test("keeps work items tenant-scoped", async () => {
        const ownerA = await register("owner-a", "Acme");
        const cookieA = cookieFrom(ownerA);
        await createDecision(cookieA);
        const proposed = await (await propose(cookieA)).json();

        const ownerB = await register("owner-b", "Other");
        const cookieB = cookieFrom(ownerB);

        const otherList = await request(server, "/api/execution/work-items", { headers: { cookie: cookieB } });
        expect(otherList.status).toBe(200);
        expect((await otherList.json()).workItems).toHaveLength(0);

        const otherGet = await request(server, `/api/execution/work-items/${encodeURIComponent(proposed.workItemId)}`, { headers: { cookie: cookieB } });
        expect(otherGet.status).toBe(404);
        expect((await otherGet.json()).error).toBe("WORK_ITEM_NOT_FOUND");

        const otherApprove = await jsonPost(`/api/execution/work-items/${encodeURIComponent(proposed.workItemId)}/approve`, cookieB, {});
        expect(otherApprove.status).toBe(404);
    });

    test("fails closed on missing decision artifact, invalid transitions and malformed input", async () => {
        const owner = await register("owner", "Acme");
        const cookie = cookieFrom(owner);

        const noDecision = await propose(cookie);
        expect(noDecision.status).toBe(422);
        expect((await noDecision.json()).error).toBe("DECISION_REQUIRED");

        const missingTitle = await jsonPost("/api/execution/work-items", cookie, { title: "   " });
        expect(missingTitle.status).toBe(400);
        expect((await missingTitle.json()).error).toBe("WORK_ITEM_TITLE_REQUIRED");

        await createDecision(cookie);
        const proposed = await (await propose(cookie)).json();
        const id = encodeURIComponent(proposed.workItemId as string);

        const earlyComplete = await jsonPost(`/api/execution/work-items/${id}/complete`, cookie, {});
        expect(earlyComplete.status).toBe(409);
        expect((await earlyComplete.json()).error).toBe("INVALID_TRANSITION");

        const approved = await jsonPost(`/api/execution/work-items/${id}/approve`, cookie, {});
        expect(approved.status).toBe(200);

        const doubleApprove = await jsonPost(`/api/execution/work-items/${id}/approve`, cookie, {});
        expect(doubleApprove.status).toBe(409);
        expect((await doubleApprove.json()).error).toBe("INVALID_TRANSITION");

        const badDueDate = await jsonPost(`/api/execution/work-items/${id}/assign`, cookie, {
            assigneeId: "ops-lead",
            dueDate: "not-a-date",
        });
        expect(badDueDate.status).toBe(400);
        expect((await badDueDate.json()).error).toBe("VALIDATION");
    });
});
