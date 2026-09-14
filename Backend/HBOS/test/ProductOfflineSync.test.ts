/**
 * Stage 12 / K2 `product.offline-sync` — runtime integration.
 *
 * Proves the canonical `SyncStateStore` owner is genuinely wired into the
 * product/runtime ingestion path: every ingestion advances a durable,
 * tenant-scoped watermark that the offline client reconciles against through
 * `GET /api/sync/state`.
 */
import { Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const CSV = "date,account,debit,credit,currency\n2026-08-01,Cash,1000,0,IRR\n2026-08-01,Sales,0,1000,IRR";

const request = async (server: Server, path: string, options: RequestInit = {}) => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server-not-listening");
  return fetch(`http://127.0.0.1:${address.port}${path}`, options);
};

const listen = (server: Server) => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
const close = (server: Server) => new Promise<void>((resolve) => server.close(() => resolve()));

const cookieFrom = (response: Response): string => {
  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error("session-cookie-missing");
  return cookie.split(";")[0];
};

let sessionCounter = 0;
const openSession = async (server: Server): Promise<string> => {
  sessionCounter += 1;
  const response = await request(server, "/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: `sync-user-${sessionCounter}`, organization: `Sync Org ${sessionCounter}` }),
  });
  expect(response.status).toBe(201);
  return cookieFrom(response);
};

const ingest = (server: Server, cookie: string, body: Record<string, unknown>) => request(server, "/api/ingest", {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify(body),
});

describe("product.offline-sync runtime integration (K2)", () => {
  let server: Server;

  beforeEach(async () => {
    server = createCommercialRuntimeServer({ databasePath: ":memory:" });
    await listen(server);
  });

  afterEach(async () => {
    await close(server);
  });

  test("successful ingestion advances a durable per-(tenant, source) sync cursor", async () => {
    const cookie = await openSession(server);
    const accepted = await ingest(server, cookie, { sourceName: "ledger.csv", format: "CSV", content: CSV });
    expect(accepted.status).toBe(201);
    const payload = await accepted.json() as { source: { sha256: string }; status: string };
    expect(payload.status).toBe("READY");

    const stateResponse = await request(server, "/api/sync/state", { headers: { cookie } });
    expect(stateResponse.status).toBe(200);
    const state = await stateResponse.json() as { tenantId: string; cursors: Array<{ sourceKey: string; cursor: { lastWatermark: string; lastSuccessAt: string } }> };
    expect(state.cursors).toHaveLength(1);
    expect(state.cursors[0].sourceKey).toBe("ledger.csv");
    expect(state.cursors[0].cursor.lastWatermark).toBe(payload.source.sha256);
    expect(state.cursors[0].cursor.lastSuccessAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const singleResponse = await request(server, "/api/sync/state?source=ledger.csv", { headers: { cookie } });
    expect(singleResponse.status).toBe(200);
    const single = await singleResponse.json() as { sourceKey: string; cursor: { lastWatermark: string } | null };
    expect(single.sourceKey).toBe("ledger.csv");
    expect(single.cursor?.lastWatermark).toBe(payload.source.sha256);
  });

  test("failed ingestion records an error cursor without losing the previous watermark", async () => {
    const cookie = await openSession(server);
    const success = await ingest(server, cookie, { sourceName: "mixed.csv", format: "CSV", content: CSV });
    const successBody = await success.json() as { source: { sha256: string } };
    expect(success.status).toBe(201);

    const failed = await ingest(server, cookie, { sourceName: "mixed.csv", format: "STRUCTURED", content: "{not-json" });
    expect(failed.status).toBe(422);
    const failedBody = await failed.json() as { error: string };
    expect(failedBody.error).toBe("ingestion-json-parse-error");

    const response = await request(server, "/api/sync/state?source=mixed.csv", { headers: { cookie } });
    const payload = await response.json() as { cursor: { lastWatermark: string; lastError?: string; lastErrorAt?: string } | null };
    expect(payload.cursor?.lastWatermark).toBe(successBody.source.sha256);
    expect(payload.cursor?.lastError).toBe("ingestion-json-parse-error");
    expect(payload.cursor?.lastErrorAt).toBeDefined();
  });

  test("sync state is tenant-scoped", async () => {
    const owner = await openSession(server);
    await ingest(server, owner, { sourceName: "ledger.csv", format: "CSV", content: CSV });

    const other = await openSession(server);
    const response = await request(server, "/api/sync/state", { headers: { cookie: other } });
    const payload = await response.json() as { cursors: unknown[] };
    expect(payload.cursors).toEqual([]);

    const foreign = await request(server, "/api/sync/state?source=ledger.csv", { headers: { cookie: other } });
    expect((await foreign.json() as { cursor: unknown }).cursor).toBeNull();
  });

  test("sync state requires authentication and rejects an empty source filter", async () => {
    const anonymous = await request(server, "/api/sync/state");
    expect(anonymous.status).toBe(401);

    const cookie = await openSession(server);
    const emptySource = await request(server, "/api/sync/state?source=", { headers: { cookie } });
    expect(emptySource.status).toBe(400);
    expect(await emptySource.json()).toEqual({ error: "SYNC_SOURCE_REQUIRED" });
  });

  test("runtime advertises offline-sync and serves the real client transport module", async () => {
    const ready = await request(server, "/api/ready");
    const capabilities = (await ready.json() as { capabilities: string[] }).capabilities;
    expect(capabilities).toContain("offline-sync");

    const asset = await request(server, "/offline-sync.js");
    expect(asset.status).toBe(200);
    expect(asset.headers.get("content-type")).toContain("text/javascript");
    expect(await asset.text()).toContain("createOfflineSync");
  });

  test("sync cursor survives a runtime restart (durability)", async () => {
    const directory = mkdtempSync(join(tmpdir(), "hooshyar-sync-runtime-"));
    const databasePath = join(directory, "runtime.sqlite");
    const username = "durable-owner";
    const organization = "Durable Org";
    const password = "durable-horse-battery";
    let first: Server | null = null;
    let second: Server | null = null;
    try {
      first = createCommercialRuntimeServer({ databasePath });
      await listen(first);
      const registered = await request(first, "/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, organization, password }),
      });
      expect(registered.status).toBe(201);
      const cookie = cookieFrom(registered);
      const accepted = await ingest(first, cookie, { sourceName: "durable.csv", format: "CSV", content: CSV });
      const acceptedBody = await accepted.json() as { source: { sha256: string } };
      expect(accepted.status).toBe(201);
      await close(first);
      first = null;

      second = createCommercialRuntimeServer({ databasePath });
      await listen(second);
      const login = await request(second, "/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, organization, password }),
      });
      expect(login.status).toBe(200);
      const cookie2 = cookieFrom(login);
      const response = await request(second, "/api/sync/state?source=durable.csv", { headers: { cookie: cookie2 } });
      const payload = await response.json() as { cursor: { lastWatermark: string } | null };
      expect(payload.cursor?.lastWatermark).toBe(acceptedBody.source.sha256);
    } finally {
      if (first) await close(first);
      if (second) await close(second);
      try { rmSync(directory, { recursive: true, force: true }); } catch { /* windows lock best effort */ }
    }
  }, 20000);
});
