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
    SESSION_RATE_LIMIT_PACING_MARGIN_RATIO,
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
    test("pacer admits a full capacity burst then waits a refill window plus a safety margin", async () => {
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
        const refillWindowMs = 1000 / SESSION_RATE_LIMIT_REFILL_PER_SECOND;
        const marginMs = Math.ceil(refillWindowMs * SESSION_RATE_LIMIT_PACING_MARGIN_RATIO);
        expect(marginMs).toBeGreaterThan(0);
        // Strictly more than the exact refill window: waiting exactly the
        // theoretical minimum leaves no surplus and reproduces the CI 429.
        expect(waits[0]).toBeGreaterThanOrEqual(refillWindowMs + marginMs);
    });

    test("pacer margin keeps the authoritative bucket solvent when the mirror clock drifts", async () => {
        // The mirror runs in a different process than the authoritative bucket,
        // so its observed elapsed time can exceed the server's. Model a pacer
        // clock 5% fast against a server bucket using real elapsed time.
        const drift = 1.05;
        const simulate = async (pacerOptions: Record<string, unknown>): Promise<number> => {
            let virtualNow = 1_700_000_000_000;
            let realNow = virtualNow;
            const server = { tokens: SESSION_RATE_LIMIT_CAPACITY, lastRefill: realNow };
            const serverAcquire = (): boolean => {
                const elapsed = realNow - server.lastRefill;
                if (elapsed > 0) {
                    server.tokens = Math.min(SESSION_RATE_LIMIT_CAPACITY, server.tokens + elapsed / 1000);
                    server.lastRefill = realNow;
                }
                if (server.tokens >= 1) { server.tokens -= 1; return true; }
                return false;
            };
            const pace = createSessionRateLimitPacer({
                now: () => virtualNow,
                sleep: async (ms: number) => { virtualNow += ms; realNow += ms / drift; },
                ...pacerOptions,
            });
            let rejected = 0;
            for (let i = 0; i < SESSION_RATE_LIMIT_CAPACITY + 2; i++) {
                await pace.acquire();
                if (!serverAcquire()) rejected += 1;
            }
            return rejected;
        };

        // Without the margin the mirror is optimistic and the authoritative
        // server correctly rejects — the exact CI failure class.
        expect(await simulate({ marginMs: 0 })).toBeGreaterThan(0);
        // With the production margin the same drift is absorbed.
        expect(await simulate({})).toBe(0);
    });

    test("pacer preserves the configured reserve when a token is replenished naturally", async () => {
        // Proven acceptance race on the trusted commit: after a full burst the
        // client idled ~one refill window, the mirror's natural refill reached
        // ~one token, and the old mirror admitted with waited=0, consuming the
        // token down to zero. Because the previous request had a larger
        // server-side dispatch latency than the next one, the authoritative
        // bucket observed less than one full token and answered 429. The
        // repaired pacer must not admit on natural refill without the reserve.
        const dispatchLags = [40, 30, 20, 10, 0, 0];
        const simulate = async (pacerOptions: Record<string, unknown>) => {
            let virtualNow = 1_700_000_000_000;
            const waits: number[] = [];
            const server = { tokens: SESSION_RATE_LIMIT_CAPACITY, lastRefill: virtualNow };
            const consumeOnServer = (consumedAt: number): boolean => {
                const elapsed = consumedAt - server.lastRefill;
                if (elapsed > 0) {
                    server.tokens = Math.min(SESSION_RATE_LIMIT_CAPACITY, server.tokens + elapsed / 1000);
                    server.lastRefill = consumedAt;
                }
                if (server.tokens >= 1) { server.tokens -= 1; return true; }
                return false;
            };
            const pace = createSessionRateLimitPacer({
                now: () => virtualNow,
                sleep: async (ms: number) => { waits.push(ms); virtualNow += ms; },
                ...pacerOptions,
            });
            let rejected = 0;
            for (let i = 0; i < SESSION_RATE_LIMIT_CAPACITY + 1; i++) {
                // The sixth request follows a natural (non-sleep) idle of one
                // full refill window: the mirror replenishes ~one token by itself.
                if (i === SESSION_RATE_LIMIT_CAPACITY) virtualNow += 1000;
                await pace.acquire();
                // Requests are consumed by the authoritative bucket after a
                // per-request dispatch latency; the previous lag is the largest.
                const consumedAt = virtualNow + dispatchLags[i];
                if (!consumeOnServer(consumedAt)) rejected += 1;
            }
            return { rejected, waits };
        };

        const repaired = await simulate({});
        // Natural refill must NOT admit with zero wait...
        expect(repaired.waits.length).toBeGreaterThan(0);
        expect(Math.min(...repaired.waits)).toBeGreaterThan(0);
        // ...and it must wait long enough to restore the configured reserve.
        const reserveRefillWindowMs = Math.ceil(
            SESSION_RATE_LIMIT_PACING_MARGIN_RATIO * (1000 / SESSION_RATE_LIMIT_REFILL_PER_SECOND)
        );
        expect(repaired.waits[0]).toBeGreaterThanOrEqual(reserveRefillWindowMs);
        // The accepted sequence never reproduces the server-side skew 429.
        expect(repaired.rejected).toBe(0);

        // Disabling the reserve reproduces the same natural-refill + dispatch-lag
        // skew as an authoritative 429, proving the reserve is what fixes it.
        const unreserved = await simulate({ marginMs: 0 });
        expect(unreserved.rejected).toBeGreaterThan(0);
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
