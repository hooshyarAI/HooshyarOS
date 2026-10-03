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

describe("product.financial-analytics — commercial runtime path", () => {
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

    const jsonPost = (path: string, cookie: string, body: unknown) => {
        clock += 1000;
        return request(server, path, {
            method: "POST",
            headers: { "content-type": "application/json", cookie },
            body: JSON.stringify(body),
        });
    };

    test("derives analytics from the tenant-scoped canonical source and persists latest", async () => {
        const owner = await register("owner", "Acme");
        const cookie = cookieFrom(owner);

        const ingested = await jsonPost("/api/ingest", cookie, { sourceName: "ledger.csv", format: "CSV", content: LEDGER });
        expect(ingested.status).toBe(201);
        const sha256 = (await ingested.json()).evidence.sha256;

        const insights = await jsonPost("/api/financial/insights", cookie, {
            sourceSha256: sha256,
            breakEven: { fixedCosts: 1000, variableCostPerUnit: 5, pricePerUnit: 10, unitsSold: 300 },
        });
        expect(insights.status).toBe(200);
        const body = await insights.json();
        expect(body.status).toBe("READY");
        expect(body.capabilityId).toBe("product.financial-analytics");
        expect(body.targetEngine).toBe("Financial Intelligence Engine");
        expect(body.ingestedSource.transactionCount).toBe(5);
        expect(body.source.sha256).toBe(sha256);
        expect(body.forecast.naive.forecast).toBe(-250);
        expect(body.anomalies.zscore.points).toHaveLength(5);
        expect(body.breakEven.breakEvenUnits).toBe(200);

        const latest = await request(server, "/api/financial/insights/latest", { headers: { cookie } });
        expect(latest.status).toBe(200);
        const latestBody = await latest.json();
        expect(latestBody.capabilityId).toBe("product.financial-analytics");
        expect(latestBody.tenantId).toBe(body.tenantId);
    });

    test("supports composite analytics from a structured statement and explicit series", async () => {
        const owner = await register("owner", "Acme");
        const cookie = cookieFrom(owner);

        const statement = {
            revenue: 1000, cogs: 600, grossProfit: 400, operatingExpenses: 200, operatingIncome: 200,
            interest: 20, preTaxIncome: 180, taxes: 30, netIncome: 150, cash: 100, receivables: 200,
            inventory: 150, currentAssets: 450, ppe: 550, totalAssets: 1000, payables: 120,
            shortTermDebt: 80, currentLiabilities: 200, longTermDebt: 200, totalLiabilities: 400, equity: 600,
        };
        const response = await jsonPost("/api/financial/insights", cookie, { statement, priorStatement: statement, series: [100, 110, 90, 130, 120] });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.status).toBe("READY");
        expect(body.ratios.profitability.netMargin).toBeCloseTo(0.15, 6);
        expect(body.ratios.horizontal.entries.length).toBeGreaterThan(0);
        expect(body.forecast.movingAverage.forecast).toBeCloseTo((90 + 130 + 120) / 3, 6);
    });

    test("fails closed on unknown source, missing input and malformed source digests", async () => {
        const owner = await register("owner", "Acme");
        const cookie = cookieFrom(owner);

        const unknownSource = await jsonPost("/api/financial/insights", cookie, { sourceSha256: "a".repeat(64) });
        expect(unknownSource.status).toBe(422);
        expect((await unknownSource.json()).error).toBe("INGESTED_SOURCE_REQUIRED");

        const emptyBody = await jsonPost("/api/financial/insights", cookie, {});
        expect(emptyBody.status).toBe(400);
        expect((await emptyBody.json()).error).toBe("ANALYTICS_INPUT_REQUIRED");

        const badDigest = await jsonPost("/api/financial/insights", cookie, { sourceSha256: "not-a-digest" });
        expect(badDigest.status).toBe(400);
        expect((await badDigest.json()).error).toBe("SOURCE_SHA256_INVALID");

        const blocked = await jsonPost("/api/financial/insights", cookie, { series: [1, Number.NaN, 3] });
        expect(blocked.status).toBe(422);
        expect((await blocked.json()).status).toBe("BLOCKED");
    });

    test("RBAC denies analytics creation for a viewer and unauthenticated callers", async () => {
        await register("owner", "Acme");
        const viewer = await register("viewer", "Acme");
        const viewerCookie = cookieFrom(viewer);

        const denied = await jsonPost("/api/financial/insights", viewerCookie, { series: [1, 2, 3] });
        expect(denied.status).toBe(403);
        expect((await denied.json()).error).toBe("INSUFFICIENT_PERMISSIONS");

        const anonymous = await request(server, "/api/financial/insights", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ series: [1, 2, 3] }),
        });
        expect(anonymous.status).toBe(401);
    });

    test("keeps the latest analytics tenant-scoped", async () => {
        const owner = await register("owner", "Acme");
        const cookie = cookieFrom(owner);
        const created = await jsonPost("/api/financial/insights", cookie, { series: [100, 110, 90, 130, 120] });
        expect(created.status).toBe(200);

        const other = await register("other-owner", "Other");
        const otherCookie = cookieFrom(other);
        const otherLatest = await request(server, "/api/financial/insights/latest", { headers: { cookie: otherCookie } });
        expect(otherLatest.status).toBe(404);
        expect((await otherLatest.json()).error).toBe("ANALYTICS_NOT_FOUND");
    });
});
