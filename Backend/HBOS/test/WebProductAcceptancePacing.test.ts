import { Server } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

/**
 * Regression guard for the CI failure
 * `WEB_ACCEPTANCE_XLSX_INGEST_FAILED:429` (Web Product Acceptance run 336).
 *
 * The acceptance harness performed six session-rate-limited requests
 * back-to-back. The canonical runtime protects them with one per-session token
 * bucket (capacity 5, refill 1/s), so a fast machine drained the bucket and
 * the sixth call (the XLSX ingest) was correctly rejected with 429. The repair
 * makes the harness mirror that bucket client-side
 * (`scripts/session-rate-limit-pacer.cjs`). These tests pin the pacer to the
 * real runtime contract and reproduce the CI rejection deterministically.
 */
const {
    createSessionRateLimitPacer,
    isSessionRateLimitedPost,
    SESSION_RATE_LIMIT_CAPACITY,
    SESSION_RATE_LIMIT_REFILL_PER_SECOND,
} = require("../../../scripts/session-rate-limit-pacer.cjs");

const CSV = "date,account,debit,credit,currency\n2026-08-01,Cash,1000,0,IRR\n2026-08-01,Sales,0,1000,IRR";

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

const listen = (server: Server) => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
const close = (server: Server) => new Promise<void>((resolve) => server.close(() => resolve()));

const startServer = async (now: () => number): Promise<Server> => {
    const server = createCommercialRuntimeServer({
        databasePath: ":memory:",
        now,
        reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true }) },
    });
    await listen(server);
    return server;
};

const openSession = async (server: Server): Promise<string> => {
    const session = await request(server, "/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "qa", organization: "org" }),
    });
    return cookieFrom(session);
};

const ingest = (server: Server, cookie: string) => request(server, "/api/ingest", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ sourceName: "ledger.csv", format: "CSV", content: CSV }),
});

describe("web acceptance session rate-limit pacing", () => {
    test("pacer admits a full capacity burst then waits exactly one refill window", async () => {
        let nowValue = 1_700_000_000_000;
        const waits: number[] = [];
        const pace = createSessionRateLimitPacer({
            now: () => nowValue,
            sleep: async (ms: number) => { waits.push(ms); nowValue += ms; },
        });

        for (let i = 0; i < SESSION_RATE_LIMIT_CAPACITY; i++) await pace.acquire();
        expect(waits).toEqual([]);

        await pace.acquire();
        expect(waits).toHaveLength(1);
        expect(waits[0]).toBeGreaterThanOrEqual(1000 / SESSION_RATE_LIMIT_REFILL_PER_SECOND);
    });

    test("route predicate matches exactly the canonical session-limited POST routes", () => {
        const limited = [
            "/api/analyze",
            "/api/financial/analyze",
            "/api/ingest",
            "/api/executive/workbench",
            "/api/decision/workbench",
            "/api/financial/insights",
            "/api/assistant",
            "/api/resilience/stress-test",
            "/api/resilience/sensitivity",
            "/api/resilience/optimize",
            "/api/impact/measure",
            "/api/improvement/improve",
            "/api/execution/work-items",
            "/api/execution/work-items/TRACE-abc-def-1/approve",
        ];
        for (const path of limited) expect(isSessionRateLimitedPost(path, "POST")).toBe(true);

        // Same paths are not limited for GET, and auth/read/export routes use a
        // different bucket or none at all.
        expect(isSessionRateLimitedPost("/api/analyze", "GET")).toBe(false);
        expect(isSessionRateLimitedPost("/api/execution/work-items", "GET")).toBe(false);
        expect(isSessionRateLimitedPost("/api/session", "POST")).toBe(false);
        expect(isSessionRateLimitedPost("/api/report/export", "POST")).toBe(false);
        expect(isSessionRateLimitedPost("/api/report", "POST")).toBe(false);
        expect(isSessionRateLimitedPost("/api/dashboard", "POST")).toBe(false);
        expect(isSessionRateLimitedPost("/api/sources", "POST")).toBe(false);
    });

    test("a sixth unpaced POST /api/ingest is rejected with 429 (CI failure reproduced deterministically)", async () => {
        const now = () => 1_700_000_000_000;
        const server = await startServer(now);
        try {
            const cookie = await openSession(server);
            for (let i = 0; i < SESSION_RATE_LIMIT_CAPACITY; i++) {
                expect((await ingest(server, cookie)).status).toBe(201);
            }
            const blocked = await ingest(server, cookie);
            expect(blocked.status).toBe(429);
            expect(await blocked.json()).toEqual({ error: "RATE_LIMIT_EXCEEDED" });
        } finally {
            await close(server);
        }
    });

    test("the same six-call burst is fully admitted when paced by the mirrored bucket", async () => {
        let nowValue = 1_700_000_000_000;
        const now = () => nowValue;
        const server = await startServer(now);
        const pace = createSessionRateLimitPacer({
            now,
            sleep: async (ms: number) => { nowValue += ms; },
        });
        try {
            const cookie = await openSession(server);
            for (let i = 0; i < SESSION_RATE_LIMIT_CAPACITY + 1; i++) {
                await pace.acquire();
                expect((await ingest(server, cookie)).status).toBe(201);
            }
        } finally {
            await close(server);
        }
    });
});
