import { Server } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

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
const ledger = "date,account,debit,credit,currency\n2026-08-01,Cash,0,1000,IRR\n2026-08-02,Sales,0,1200,IRR\n2026-08-03,Expense,300,0,IRR";

describe("product.financial-feasibility — commercial runtime path", () => {
    let server: Server;
    beforeEach(async () => {
        server = createCommercialRuntimeServer({ databasePath: ":memory:", reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true, answer: "verified" }) } });
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    });
    afterEach(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
    const register = (username: string, organization: string) => request(server, "/api/auth/register", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password: "Sup3rSecret!", organization })
    });
    const post = (path: string, cookie: string, body: unknown, key?: string) => request(server, path, {
        method: "POST", headers: { "content-type": "application/json", cookie, ...(key ? { "idempotency-key": key } : {}) }, body: JSON.stringify(body)
    });

    test("persists review-gated scenarios per tenant and supports idempotent replay", async () => {
        const owner = await register("feas-owner", "Project Org");
        const cookie = cookieFrom(owner);
        const ingested = await post("/api/ingest", cookie, { sourceName: "project.csv", format: "CSV", content: ledger });
        expect(ingested.status).toBe(201);
        const sourceSha256 = (await ingested.json()).evidence.sha256;
        const session = await (await request(server, "/api/session", { headers: { cookie } })).json();
        const input = { sourceSha256, projectName: "Factory", currency: "IRR", initialInvestment: 1000, discountRatePercent: 10, cashFlows: [400, 400, 400, 400] };

        const created = await post("/api/feasibility/financial", cookie, input, "feasibility:test");
        expect(created.status).toBe(200);
        const result = await created.json();
        expect(result.tenantId).toBe(session.tenantId);
        expect(result.capabilityId).toBe("product.financial-feasibility");
        expect(result.npv.npv).toBeGreaterThan(0);
        expect(result.cashFlowScenarios.entries).toHaveLength(5);
        expect(result.qualification).toBe("REVIEW_REQUIRED");
        expect(result.source.linkStatus).toBe("LINKED_NOT_RECONCILED");

        const replay = await post("/api/feasibility/financial", cookie, input, "feasibility:test");
        expect(replay.status).toBe(200);
        expect(replay.headers.get("Idempotency-Replayed")).toBe("true");
        const latest = await request(server, "/api/feasibility/financial/latest", { headers: { cookie } });
        expect(latest.status).toBe(200);

        const other = await register("feas-other", "Other Org");
        expect((await request(server, "/api/feasibility/financial/latest", { headers: { cookie: cookieFrom(other) } })).status).toBe(404);
    });

    test("rejects unknown sources and denies viewers", async () => {
        const owner = await register("feas-owner", "Project Org");
        const cookie = cookieFrom(owner);
        const unknown = await post("/api/feasibility/financial", cookie, { sourceSha256: "a".repeat(64), projectName: "P", currency: "IRR", initialInvestment: 100, discountRatePercent: 10, cashFlows: [50, 60] });
        expect(unknown.status).toBe(422);
        const ingested = await post("/api/ingest", cookie, { sourceName: "project.csv", format: "CSV", content: ledger });
        const sha = (await ingested.json()).evidence.sha256;
        const viewer = await register("feas-viewer", "Project Org");
        const denied = await post("/api/feasibility/financial", cookieFrom(viewer), { sourceSha256: sha, projectName: "P", currency: "IRR", initialInvestment: 100, discountRatePercent: 10, cashFlows: [50, 60] });
        expect(denied.status).toBe(403);
    });
});
