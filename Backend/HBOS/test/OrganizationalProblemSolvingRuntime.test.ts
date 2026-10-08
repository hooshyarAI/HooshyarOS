import { Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const listen = (server: Server) => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const close = (server: Server) => new Promise<void>((resolve) => server.close(() => resolve()));

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

const jsonPost = (cookie: string | undefined, body: unknown, extraHeaders: Record<string, string> = {}): RequestInit => ({
    method: "POST",
    headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
        ...extraHeaders,
    },
    body: JSON.stringify(body),
});

const register = async (server: Server, username: string, organization: string) => {
    const response = await request(server, "/api/auth/register", jsonPost(undefined, { username, organization, password: "S3cret-pass!" }));
    expect(response.status).toBe(201);
    return cookieFrom(response);
};

describe("Organizational Problem-Solving runtime acceptance", () => {
    let dir: string;
    let dbPath: string;
    let server: Server;

    beforeEach(async () => {
        dir = mkdtempSync(join(tmpdir(), "hos-problem-runtime-"));
        dbPath = join(dir, "runtime.sqlite");
        server = createCommercialRuntimeServer({ databasePath: dbPath });
        await listen(server);
    });

    afterEach(async () => {
        await close(server);
        rmSync(dir, { recursive: true, force: true });
    });

    test("runs the full governed lifecycle over real HTTP and survives restart", async () => {
        const cookie = await register(server, "owner1", "org-a");

        const created = await request(server, "/api/problems", jsonPost(cookie, {
            title: "Approvals are slow",
            scope: "procurement approvals",
            category: "PROCESS",
            severity: "HIGH",
            description: "Approval cycle time is unacceptable",
        }));
        expect(created.status).toBe(201);
        const createdBody = await created.json();
        const problemId = createdBody.id as string;
        expect(problemId).toMatch(/^PROBLEM-/);
        expect(createdBody.stage).toBe("OPEN");

        const advance = async (stage: string, payload: Record<string, unknown> = {}) => {
            // The runtime enforces a real per-session token bucket (capacity 5,
            // refill 1/s). A 10-step lifecycle intentionally exceeds it, so the
            // client paces on 429 exactly as the shipped web client does.
            for (let attempt = 0; attempt < 25; attempt += 1) {
                const response = await request(server, `/api/problems/${problemId}/advance`, jsonPost(cookie, { stage, ...payload }));
                if (response.status !== 429) return response;
                await new Promise((resolve) => setTimeout(resolve, 1100));
            }
            throw new Error("rate-limit-not-cleared");
        };

        expect((await advance("DEFINE", { statement: "Procurement approvals block delivery", impactedProcesses: ["Procurement"], successCriteria: ["Cycle time < 3 days"] })).status).toBe(200);

        const evidenced = await advance("EVIDENCE", {
            evidence: [
                { category: "DELAY", summary: "Average 9 days", source: "ERP" },
                { category: "PROCESS", summary: "Three sequential stages", source: "Process map" },
                { category: "PEOPLE", summary: "Approvers unavailable", source: "HR" },
                { category: "DATA", summary: "No SLA tracking", source: "Audit" },
            ],
        });
        expect(evidenced.status).toBe(200);
        expect((await evidenced.json()).evidenceCompleteness).toBe(1);

        expect((await advance("HYPOTHESES")).status).toBe(200);
        expect((await advance("ROOT_CAUSE")).status).toBe(200);
        const optionsResponse = await advance("OPTIONS", {
            options: [
                { id: "opt-a", description: "Parallelize approval stages" },
                { id: "opt-b", description: "Delegate low-value approvals" },
            ],
        });
        expect(optionsResponse.status).toBe(200);

        const decided = await advance("DECIDE", { selectedOptionId: "opt-a", rationale: "parallel is fastest" });
        expect(decided.status).toBe(200);
        expect((await decided.json()).decision.governanceStatus).toBe("ALLOWED");

        expect((await advance("PLAN", { objective: "Parallelize approvals", steps: ["redesign"], requiredApprovals: ["human-approver"] })).status).toBe(200);
        expect((await advance("EXECUTE")).status).toBe(200);

        const outcome = await advance("OUTCOME", {
            baseline: { tenantId: createdBody.tenantId, revenue: 1000, profit: 200, profitMargin: 0.2, debtRatio: 0.4, cycleTime: 100, throughput: 10, errorRate: 5, capacity: 100, operatingCost: 1000, decisionLatency: 50, riskScore: 20, recordedAt: "2026-01-01T00:00:00Z" },
            post: { tenantId: createdBody.tenantId, revenue: 1200, profit: 320, profitMargin: 0.267, debtRatio: 0.35, cycleTime: 80, throughput: 12, errorRate: 3, capacity: 120, operatingCost: 800, decisionLatency: 30, riskScore: 15, recordedAt: "2026-02-01T00:00:00Z" },
            expected: { timeSaved: 20, costReduced: 200, capacityRelease: 20, qualityImprovement: 2, riskReduction: 5, financialValue: 500, roi: 0.5 },
        });
        expect(outcome.status).toBe(200);
        const outcomeBody = await outcome.json();
        expect(outcomeBody.outcome.actionOutcome).toBe("SUCCESS");

        expect((await advance("LEARN")).status).toBe(200);

        const readBack = await request(server, `/api/problems/${problemId}`, { headers: { cookie } });
        expect(readBack.status).toBe(200);
        const readBody = await readBack.json();
        expect(readBody.stage).toBe("LEARNED");
        expect(readBody.knowledge.knowledgeId).toBeTruthy();
        expect(readBody.metrics.timeToResolutionMs).not.toBeNull();

        const list = await request(server, "/api/problems?limit=10", { headers: { cookie } });
        expect(list.status).toBe(200);
        const listBody = await list.json();
        expect(listBody.pagination.total).toBe(1);
        expect(listBody.problems[0].id).toBe(problemId);

        // Restart the server on the same database: the case and session must survive.
        await close(server);
        server = createCommercialRuntimeServer({ databasePath: dbPath });
        await listen(server);
        const afterRestart = await request(server, `/api/problems/${problemId}`, { headers: { cookie } });
        expect(afterRestart.status).toBe(200);
        expect((await afterRestart.json()).stage).toBe("LEARNED");
    }, 120000);

    test("enforces authentication, tenant isolation and idempotency", async () => {
        const anonymous = await request(server, "/api/problems");
        expect(anonymous.status).toBe(401);

        const cookie = await register(server, "owner2", "org-x");
        const payload = { title: "Cross-tenant check", scope: "scope-x", category: "DATA", severity: "LOW" };

        const first = await request(server, "/api/problems", jsonPost(cookie, payload, { "idempotency-key": "problem-open-1" }));
        expect(first.status).toBe(201);
        const firstBody = await first.json();

        const replay = await request(server, "/api/problems", jsonPost(cookie, payload, { "idempotency-key": "problem-open-1" }));
        expect(replay.status).toBe(201);
        expect((await replay.json()).id).toBe(firstBody.id);
        expect(replay.headers.get("idempotency-replayed")).toBe("true");

        const otherCookie = await register(server, "owner3", "org-y");
        const crossTenant = await request(server, `/api/problems/${firstBody.id}`, { headers: { cookie: otherCookie } });
        expect(crossTenant.status).toBe(404);

        const crossTenantList = await request(server, "/api/problems", { headers: { cookie: otherCookie } });
        expect(crossTenantList.status).toBe(200);
        expect((await crossTenantList.json()).pagination.total).toBe(0);
    }, 60000);

    test("rejects unknown stages and unauthorized decision attempts", async () => {
        const cookie = await register(server, "owner4", "org-z");
        const created = await request(server, "/api/problems", jsonPost(cookie, { title: "Stage guard" }));
        const problemId = (await created.json()).id as string;

        const unknown = await request(server, `/api/problems/${problemId}/advance`, jsonPost(cookie, { stage: "TELEPORT" }));
        expect(unknown.status).toBe(400);
        expect((await unknown.json()).error).toBe("PROBLEM_STAGE_UNKNOWN");

        const decideTooEarly = await request(server, `/api/problems/${problemId}/advance`, jsonPost(cookie, { stage: "DECIDE", selectedOptionId: "x", rationale: "y" }));
        expect(decideTooEarly.status).toBe(422);
    }, 60000);
});
