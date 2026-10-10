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

const LEDGER = [
    "date,account,debit,credit,currency",
    "2026-08-01,Cash,0,1000,IRR",
    "2026-08-02,Sales,0,1200,IRR",
    "2026-08-03,Expense,300,0,IRR",
    "2026-08-04,Receivable,0,900,IRR",
    "2026-08-05,Expense,250,0,IRR",
].join("\n");

describe("product.cost-management — commercial runtime path", () => {
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

    const jsonPost = (path: string, cookie: string, body: unknown, extraHeaders: Record<string, string> = {}) => {
        clock += 1000;
        return request(server, path, {
            method: "POST",
            headers: { "content-type": "application/json", cookie, ...extraHeaders },
            body: JSON.stringify(body),
        });
    };

    test("persists cost-center and category variance with explicit review qualification", async () => {
        const owner = await register("cost-owner", "Factory");
        const cookie = cookieFrom(owner);
        const ingested = await jsonPost("/api/ingest", cookie, { sourceName: "cost-ledger.csv", format: "CSV", content: LEDGER });
        expect(ingested.status).toBe(201);
        const sourceSha256 = (await ingested.json()).evidence.sha256;
        const session = await request(server, "/api/session", { headers: { cookie } });
        const ownerSession = await session.json();

        const body = {
            sourceSha256,
            lines: [
                { lineId: "line-1", costCenterId: "factory", category: "materials", currency: "IRR", planned: 1000, actual: 1200 },
                { lineId: "line-2", costCenterId: "factory", category: "labor", currency: "IRR", planned: 500, actual: 300 },
                { lineId: "line-3", costCenterId: "office", category: "materials", currency: "IRR", planned: 250, actual: 250 }
            ]
        };
        const created = await jsonPost("/api/budget/cost-breakdown", cookie, body, { "idempotency-key": "cost-test:create" });
        expect(created.status).toBe(200);
        const result = await created.json();
        expect(result.status).toBe("READY");
        expect(result.capabilityId).toBe("product.cost-management");
        expect(result.targetEngine).toBe("BudgetIntelligenceEngine");
        expect(result.tenantId).toBe(ownerSession.tenantId);
        expect(result.total).toEqual(expect.objectContaining({ planned: 1750, actual: 1750, variance: 0 }));
        expect(result.byCostCenter).toHaveLength(2);
        expect(result.byCategory).toHaveLength(2);
        expect(result.source).toEqual(expect.objectContaining({ sha256: sourceSha256, linkStatus: "LINKED_NOT_RECONCILED" }));
        expect(result.qualification).toBe("REVIEW_REQUIRED");

        const replay = await jsonPost("/api/budget/cost-breakdown", cookie, body, { "idempotency-key": "cost-test:create" });
        expect(replay.status).toBe(200);
        expect(replay.headers.get("Idempotency-Replayed")).toBe("true");

        const latest = await request(server, "/api/budget/cost-breakdown/latest", { headers: { cookie } });
        expect(latest.status).toBe(200);
        expect((await latest.json()).total.variance).toBe(0);

        const other = await register("cost-other", "Other");
        const otherCookie = cookieFrom(other);
        const crossTenantLatest = await request(server, "/api/budget/cost-breakdown/latest", { headers: { cookie: otherCookie } });
        expect(crossTenantLatest.status).toBe(404);
        expect((await crossTenantLatest.json()).error).toBe("BUDGET_COST_BREAKDOWN_NOT_FOUND");
    });

    test("rejects invalid or unknown source and enforces write permissions", async () => {
        const owner = await register("cost-owner", "Factory");
        const cookie = cookieFrom(owner);
        const badDigest = await jsonPost("/api/budget/cost-breakdown", cookie, { sourceSha256: "wrong", lines: [] });
        expect(badDigest.status).toBe(400);
        expect((await badDigest.json()).error).toBe("SOURCE_SHA256_REQUIRED");

        const unknownSource = await jsonPost("/api/budget/cost-breakdown", cookie, {
            sourceSha256: "a".repeat(64),
            lines: [{ lineId: "l", costCenterId: "factory", category: "materials", currency: "IRR", planned: 1, actual: 1 }]
        });
        expect(unknownSource.status).toBe(422);
        expect((await unknownSource.json()).error).toBe("INGESTED_SOURCE_REQUIRED");

        const ingested = await jsonPost("/api/ingest", cookie, { sourceName: "cost-ledger.csv", format: "CSV", content: LEDGER });
        const sha = (await ingested.json()).evidence.sha256;
        const emptyLines = await jsonPost("/api/budget/cost-breakdown", cookie, { sourceSha256: sha, lines: [] });
        expect(emptyLines.status).toBe(422);
        expect((await emptyLines.json()).reason).toBe("COST_LINES_REQUIRED");

        const viewer = await register("cost-viewer", "Factory");
        const viewerCookie = cookieFrom(viewer);
        const denied = await jsonPost("/api/budget/cost-breakdown", viewerCookie, {
            sourceSha256: sha,
            lines: [{ lineId: "l", costCenterId: "factory", category: "materials", currency: "IRR", planned: 1, actual: 1 }]
        });
        expect(denied.status).toBe(403);

        const anonymous = await request(server, "/api/budget/cost-breakdown", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sourceSha256: sha, lines: [] })
        });
        expect(anonymous.status).toBe(401);
    });
});
