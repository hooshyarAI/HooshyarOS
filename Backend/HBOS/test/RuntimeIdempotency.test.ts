import { Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";

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

describe("standardization.idempotency — canonical persistence primitives", () => {
    test("writeIfAbsent is an atomic single-writer claim and is tenant-scoped", async () => {
        const store = new SQLitePersistenceStore({ databasePath: ":memory:" });

        const first = await store.writeIfAbsent({ tenantId: "tenant-a" }, "claim", { value: 1 });
        expect(first.created).toBe(true);

        const second = await store.writeIfAbsent({ tenantId: "tenant-a" }, "claim", { value: 2 });
        expect(second.created).toBe(false);
        expect((second.record.value as { value: number }).value).toBe(1);

        const otherTenant = await store.writeIfAbsent({ tenantId: "tenant-b" }, "claim", { value: 3 });
        expect(otherTenant.created).toBe(true);

        await store.delete({ tenantId: "tenant-a" }, "claim");
        const reclaimed = await store.writeIfAbsent({ tenantId: "tenant-a" }, "claim", { value: 4 });
        expect(reclaimed.created).toBe(true);
        expect((reclaimed.record.value as { value: number }).value).toBe(4);

        store.close();
    });

    test("claim evidence survives a reopen of the same database", async () => {
        const directory = mkdtempSync(join(tmpdir(), "hooshyar-idempotency-"));
        const databasePath = join(directory, "idempotency.sqlite");
        try {
            const first = new SQLitePersistenceStore({ databasePath });
            await first.writeIfAbsent({ tenantId: "tenant-a" }, "claim", { requestHash: "abc", status: "COMPLETED" });
            first.close();

            const reopened = new SQLitePersistenceStore({ databasePath });
            const replay = await reopened.writeIfAbsent({ tenantId: "tenant-a" }, "claim", { requestHash: "other" });
            expect(replay.created).toBe(false);
            expect((replay.record.value as { requestHash: string }).requestHash).toBe("abc");
            reopened.close();
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    });
});

describe("standardization.idempotency — runtime mutation contract", () => {
    let server: Server;
    let clock: number;

    beforeEach(async () => {
        clock = 1_900_000_000_000;
        server = createCommercialRuntimeServer({ databasePath: ":memory:", now: () => clock });
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    });

    afterEach(async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    const tick = () => { clock += 1000; };

    const register = (username: string, organization: string) =>
        request(server, "/api/auth/register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username, password: "Sup3rSecret!", organization }),
        });

    const postWithKey = (path: string, cookie: string, body: unknown, key?: string) => {
        tick();
        const headers: Record<string, string> = { "content-type": "application/json", cookie };
        if (key !== undefined) headers["idempotency-key"] = key;
        return request(server, path, { method: "POST", headers, body: JSON.stringify(body) });
    };

    const list = async (path: string, cookie: string) => {
        const response = await request(server, path, { headers: { cookie } });
        expect(response.status).toBe(200);
        return response.json();
    };

    const seedDecision = async (cookie: string) => {
        const decision = await postWithKey("/api/decision/workbench", cookie, DECISION_BODY);
        expect(decision.status).toBe(200);
    };

    const seedAnalysis = async (cookie: string) => {
        const analysis = await postWithKey("/api/analyze", cookie, { csv: CSV, sourceName: "ledger.csv", assets: 10000, liabilities: 2500 });
        expect(analysis.status).toBe(200);
    };

    test("a replayed key returns the exact stored response without a second side effect", async () => {
        const cookie = cookieFrom(await register("owner", "Acme"));
        await seedDecision(cookie);

        const first = await postWithKey("/api/execution/work-items", cookie, { title: "idempotent proposal" }, "propose-key-1");
        expect(first.status).toBe(200);
        expect(first.headers.get("idempotency-replayed")).toBeNull();
        const created = await first.json();

        const replay = await postWithKey("/api/execution/work-items", cookie, { title: "idempotent proposal" }, "propose-key-1");
        expect(replay.status).toBe(200);
        expect(replay.headers.get("idempotency-replayed")).toBe("true");
        expect(await replay.json()).toEqual(created);

        const listed = await list("/api/execution/work-items", cookie);
        expect(listed.pagination.total).toBe(1);
    });

    test("a key reused with a different body fails closed", async () => {
        const cookie = cookieFrom(await register("owner", "Acme"));
        await seedDecision(cookie);

        const first = await postWithKey("/api/execution/work-items", cookie, { title: "first" }, "conflict-key");
        expect(first.status).toBe(200);

        const conflict = await postWithKey("/api/execution/work-items", cookie, { title: "different" }, "conflict-key");
        expect(conflict.status).toBe(409);
        expect((await conflict.json()).error).toBe("IDEMPOTENCY_KEY_CONFLICT");

        const listed = await list("/api/execution/work-items", cookie);
        expect(listed.pagination.total).toBe(1);
    });

    test("an invalid idempotency key is rejected before any side effect", async () => {
        const cookie = cookieFrom(await register("owner", "Acme"));
        await seedDecision(cookie);

        const invalid = await postWithKey("/api/execution/work-items", cookie, { title: "bad key" }, "not a valid key!");
        expect(invalid.status).toBe(400);
        expect((await invalid.json()).error).toBe("IDEMPOTENCY_KEY_INVALID");

        const listed = await list("/api/execution/work-items", cookie);
        expect(listed.pagination.total).toBe(0);
    });

    test("report export is replay-safe and preserves a single artifact", async () => {
        const cookie = cookieFrom(await register("owner", "Acme"));
        await seedAnalysis(cookie);

        const first = await postWithKey("/api/report/export", cookie, { format: "TXT" }, "export-key");
        expect(first.status).toBe(201);
        const artifact = await first.json();

        const replay = await postWithKey("/api/report/export", cookie, { format: "TXT" }, "export-key");
        expect(replay.status).toBe(201);
        expect(replay.headers.get("idempotency-replayed")).toBe("true");
        const replayed = await replay.json();
        expect(replayed.artifact.artifactId).toBe(artifact.artifact.artifactId);

        const listed = await list("/api/report/artifacts", cookie);
        expect(listed.pagination.total).toBe(1);
    });

    test("ingest is replay-safe and preserves a single raw source", async () => {
        const cookie = cookieFrom(await register("owner", "Acme"));

        const body = { sourceName: "ledger.csv", format: "CSV", content: CSV };
        const first = await postWithKey("/api/ingest", cookie, body, "ingest-key");
        expect(first.status).toBe(201);
        const ingested = await first.json();

        const replay = await postWithKey("/api/ingest", cookie, body, "ingest-key");
        expect(replay.status).toBe(201);
        expect(replay.headers.get("idempotency-replayed")).toBe("true");
        expect((await replay.json()).evidence.sha256).toBe(ingested.evidence.sha256);

        const listed = await list("/api/sources", cookie);
        expect(listed.pagination.total).toBe(1);
    });

    test("without a key the endpoint keeps its original non-idempotent contract", async () => {
        const cookie = cookieFrom(await register("owner", "Acme"));
        await seedDecision(cookie);

        const first = await postWithKey("/api/execution/work-items", cookie, { title: "no key" });
        const second = await postWithKey("/api/execution/work-items", cookie, { title: "no key" });
        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(first.headers.get("idempotency-replayed")).toBeNull();

        const listed = await list("/api/execution/work-items", cookie);
        expect(listed.pagination.total).toBe(2);
    });

    test("the same key is isolated per tenant", async () => {
        const acme = cookieFrom(await register("owner", "Acme"));
        const beta = cookieFrom(await register("other", "Beta"));
        await seedDecision(acme);
        await seedDecision(beta);

        const sharedKey = "cross-tenant-key";
        const first = await postWithKey("/api/execution/work-items", acme, { title: "acme item" }, sharedKey);
        expect(first.status).toBe(200);
        const acmeItem = await first.json();

        const betaResponse = await postWithKey("/api/execution/work-items", beta, { title: "acme item" }, sharedKey);
        expect(betaResponse.status).toBe(200);
        expect(betaResponse.headers.get("idempotency-replayed")).toBeNull();
        const betaItem = await betaResponse.json();
        expect(betaItem.tenantId).not.toBe(acmeItem.tenantId);
        expect(betaItem.workItemId).not.toBe(acmeItem.workItemId);

        expect((await list("/api/execution/work-items", acme)).pagination.total).toBe(1);
        expect((await list("/api/execution/work-items", beta)).pagination.total).toBe(1);
    });

    test("a failed outcome releases the claim so a legitimate retry can succeed", async () => {
        const cookie = cookieFrom(await register("owner", "Acme"));

        const failed = await postWithKey("/api/report/export", cookie, { format: "TXT" }, "retry-key");
        expect(failed.status).toBe(422);

        await seedAnalysis(cookie);

        const retried = await postWithKey("/api/report/export", cookie, { format: "TXT" }, "retry-key");
        expect(retried.status).toBe(201);
        expect(retried.headers.get("idempotency-replayed")).toBeNull();

        const listed = await list("/api/report/artifacts", cookie);
        expect(listed.pagination.total).toBe(1);
    });

    test("concurrent duplicate submissions create exactly one side effect", async () => {
        const cookie = cookieFrom(await register("owner", "Acme"));
        await seedDecision(cookie);

        const body = { title: "concurrent proposal" };
        const [a, b] = await Promise.all([
            postWithKey("/api/execution/work-items", cookie, body, "race-key"),
            postWithKey("/api/execution/work-items", cookie, body, "race-key"),
        ]);

        // Exactly one submission creates the side effect; the other either
        // replays the completed response or fails closed while in progress.
        for (const status of [a.status, b.status]) {
            expect([200, 409]).toContain(status);
        }
        expect([a.status, b.status]).toContain(200);

        const listed = await list("/api/execution/work-items", cookie);
        expect(listed.pagination.total).toBe(1);

        const winners = [a, b].filter((response) => response.status === 200);
        const payloads = await Promise.all(winners.map((response) => response.json()));
        for (const payload of payloads) {
            expect(payload.workItemId).toBe(listed.workItems[0].workItemId);
        }
    });
});

describe("standardization.idempotency — durable replay across restart", () => {
    test("a completed key replays after the process restarts on the same database", async () => {
        const directory = mkdtempSync(join(tmpdir(), "hooshyar-idempotency-restart-"));
        const databasePath = join(directory, "runtime.sqlite");
        const clock = 1_900_000_000_000;
        const start = async () => {
            const server = createCommercialRuntimeServer({ databasePath, now: () => clock });
            await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
            return server;
        };
        const stop = (server: Server) => new Promise<void>((resolve) => server.close(() => resolve()));

        try {
            const first = await start();
            const register = await request(first, "/api/auth/register", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ username: "owner", password: "Sup3rSecret!", organization: "Acme" }),
            });
            const cookie = cookieFrom(register);

            const analysis = await request(first, "/api/analyze", {
                method: "POST",
                headers: { "content-type": "application/json", cookie },
                body: JSON.stringify({ csv: CSV, sourceName: "ledger.csv", assets: 10000, liabilities: 2500 }),
            });
            expect(analysis.status).toBe(200);

            const exported = await request(first, "/api/report/export", {
                method: "POST",
                headers: { "content-type": "application/json", cookie, "idempotency-key": "durable-key" },
                body: JSON.stringify({ format: "TXT" }),
            });
            expect(exported.status).toBe(201);
            const artifactId = (await exported.json()).artifact.artifactId;
            await stop(first);

            const second = await start();
            const relogin = await request(second, "/api/auth/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ username: "owner", password: "Sup3rSecret!", organization: "Acme" }),
            });
            expect(relogin.status).toBe(200);
            const cookie2 = cookieFrom(relogin);

            const replay = await request(second, "/api/report/export", {
                method: "POST",
                headers: { "content-type": "application/json", cookie: cookie2, "idempotency-key": "durable-key" },
                body: JSON.stringify({ format: "TXT" }),
            });
            expect(replay.status).toBe(201);
            expect(replay.headers.get("idempotency-replayed")).toBe("true");
            expect((await replay.json()).artifact.artifactId).toBe(artifactId);

            const listed = await request(second, "/api/report/artifacts", { headers: { cookie: cookie2 } });
            const listedBody = await listed.json();
            expect(listedBody.artifacts).toHaveLength(1);
            await stop(second);
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    }, 30000);
});
