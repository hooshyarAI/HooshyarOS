/**
 * Stage 12 / K2 `product.offline-sync` — client transport behavior.
 *
 * Exercises the real browser module `web/offline-sync.js` (loaded by
 * `web/app.js`) against a fake network so the offline-retention and
 * conflict-resolution guarantees are asserted behaviorally.
 */
const { createOfflineSync, memoryStorage } = require("../../../web/offline-sync.js");

interface FakeResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

const makeResponse = (status: number, payload: unknown, headers: Record<string, string> = {}): FakeResponse => {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) normalized[key.toLowerCase()] = value;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => normalized[String(name).toLowerCase()] ?? null },
    json: async () => payload,
  };
};

const routeFetch = (handlers: {
  state?: (sourceKey: string | null) => FakeResponse;
  ingest?: (body: Record<string, unknown>) => FakeResponse;
}) => {
  const calls: Array<{ url: string; init: { method?: string; headers?: Record<string, string>; body?: string } }> = [];
  const fetchImpl = async (url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).startsWith("/api/sync/state")) {
      const sourceKey = String(url).includes("?source=") ? decodeURIComponent(String(url).split("?source=")[1]) : null;
      return handlers.state ? handlers.state(sourceKey) : makeResponse(200, { status: "READY", cursor: null });
    }
    if (String(url) === "/api/ingest" && (init.method ?? "GET") === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      return handlers.ingest ? handlers.ingest(body) : makeResponse(201, { status: "READY", source: { sha256: "wm-new" } });
    }
    throw new Error(`unexpected-request:${init.method ?? "GET"} ${url}`);
  };
  return { fetchImpl, calls };
};

describe("product.offline-sync client transport (K2)", () => {
  test("enqueue persists work before any network attempt and survives a new instance", async () => {
    const storage = memoryStorage();
    const neverFetch = async () => { throw new Error("network-must-not-be-called-by-enqueue"); };
    const first = createOfflineSync({ storage, fetchImpl: neverFetch, now: () => 1000 });
    const job = first.enqueue({ sourceName: "offline.csv", format: "CSV", content: "a,b\n1,2" });
    expect(first.pending()).toHaveLength(1);

    const second = createOfflineSync({ storage, fetchImpl: neverFetch, now: () => 2000 });
    const restored = second.pending();
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe(job.id);
    expect(restored[0].status).toBe("PENDING");
  });

  test("network loss during sync retains work and never discards it", async () => {
    const storage = memoryStorage();
    const offlineFetch = async () => { throw new TypeError("Failed to fetch"); };
    const sync = createOfflineSync({ storage, fetchImpl: offlineFetch, now: () => 1 });
    sync.enqueue({ sourceName: "a.csv", format: "CSV", content: "a,b\n1,2" });

    const report = await sync.sync();
    expect(report.status).toBe("OFFLINE");
    expect(report.pending).toBe(1);
    expect(report.synced).toEqual([]);
    expect(report.rejected).toEqual([]);

    const retained = sync.pending();
    expect(retained).toHaveLength(1);
    expect(retained[0].attempts).toBe(1);
    expect(retained[0].status).toBe("PENDING");
  });

  test("reconnect replays queued work with the same idempotency key and reconciles server state", async () => {
    const storage = memoryStorage();
    const { fetchImpl, calls } = routeFetch({
      state: () => makeResponse(200, { status: "READY", cursor: { lastWatermark: "wm-old" } }),
      ingest: () => makeResponse(201, { status: "READY", source: { sha256: "wm-new" } }, { "Idempotency-Replayed": "true" }),
    });
    const sync = createOfflineSync({ storage, fetchImpl, now: () => 5 });
    const job = sync.enqueue({ sourceName: "a.csv", format: "CSV", content: "a,b\n1,2", baseWatermark: "wm-old" });

    const report = await sync.sync();
    expect(report.status).toBe("ONLINE");
    expect(report.synced).toEqual([{ id: job.id, sourceKey: "a.csv", watermark: "wm-new", replayed: true }]);
    expect(report.conflicts).toEqual([]);
    expect(sync.pending()).toEqual([]);

    const ingestCall = calls.find(call => call.url === "/api/ingest");
    expect(ingestCall?.init.headers?.["idempotency-key"]).toBe(job.idempotencyKey);
  });

  test("a server advance while offline is detected and resolved server-authoritative", async () => {
    const { fetchImpl } = routeFetch({
      state: () => makeResponse(200, { status: "READY", cursor: { lastWatermark: "server-2" } }),
      ingest: () => makeResponse(201, { status: "READY", source: { sha256: "wm-3" } }),
    });
    const sync = createOfflineSync({ storage: memoryStorage(), fetchImpl, now: () => 9 });
    const job = sync.enqueue({ sourceName: "a.csv", format: "CSV", content: "a,b\n1,2", baseWatermark: "base-1" });

    const report = await sync.sync();
    expect(report.conflicts).toHaveLength(1);
    expect(report.conflicts[0]).toMatchObject({
      id: job.id,
      sourceKey: "a.csv",
      baseWatermark: "base-1",
      serverWatermark: "server-2",
      resolvedWatermark: "wm-3",
      resolution: "server-authoritative",
    });
    expect(report.synced).toHaveLength(1);
    expect(sync.pending()).toEqual([]);
  });

  test("a non-transient rejection is surfaced and not silently retried", async () => {
    const { fetchImpl } = routeFetch({
      state: () => makeResponse(200, { status: "READY", cursor: null }),
      ingest: () => makeResponse(422, { error: "ingestion-json-parse-error" }),
    });
    const sync = createOfflineSync({ storage: memoryStorage(), fetchImpl, now: () => 3 });
    const job = sync.enqueue({ sourceName: "bad.json", format: "STRUCTURED", content: "{not-json" });

    const report = await sync.sync();
    expect(report.rejected).toEqual([{ id: job.id, sourceKey: "bad.json", error: "ingestion-json-parse-error" }]);
    expect(report.synced).toEqual([]);
    expect(sync.pending()).toEqual([]);
  });

  test("a transient server failure keeps the job pending for retry", async () => {
    const { fetchImpl } = routeFetch({
      state: () => makeResponse(200, { status: "READY", cursor: null }),
      ingest: () => makeResponse(429, { error: "RATE_LIMIT_EXCEEDED" }),
    });
    const sync = createOfflineSync({ storage: memoryStorage(), fetchImpl, now: () => 4 });
    sync.enqueue({ sourceName: "a.csv", format: "CSV", content: "a,b\n1,2" });

    const report = await sync.sync();
    expect(report.pending).toBe(1);
    expect(report.synced).toEqual([]);
    expect(report.rejected).toEqual([]);
    expect(sync.pending()[0].lastError).toBe("RATE_LIMIT_EXCEEDED");
  });

  test("serverState exposes the canonical cursor used for reconciliation", async () => {
    const { fetchImpl } = routeFetch({
      state: sourceKey => makeResponse(200, { status: "READY", sourceKey, cursor: { lastWatermark: "wm-canonical" } }),
    });
    const sync = createOfflineSync({ storage: memoryStorage(), fetchImpl });
    const state = await sync.serverState("a.csv") as { sourceKey: string; cursor: { lastWatermark: string } };
    expect(state.sourceKey).toBe("a.csv");
    expect(state.cursor.lastWatermark).toBe("wm-canonical");
  });
});
