/**
 * Stage 12 / K2 `product.offline-sync` — client transport behavior.
 *
 * Exercises the real browser module `web/offline-sync.js` (loaded by
 * `web/app.js`) against a fake network so the offline-retention and
 * conflict-resolution guarantees are asserted behaviorally.
 *
 * K8 commercial-acceptance repair adds deterministic coverage for the failure
 * taxonomy and the bounded/binary-safe storage contract.
 */
const {
  createOfflineSync,
  memoryStorage,
  formatFromSourceName,
  isBinaryFormat,
  classifyHttpStatus,
  classifyFailure,
  isConnectivityFailure,
  isQuotaError,
  FAILURE_KINDS,
} = require("../../../web/offline-sync.js");

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

const quotaError = () => {
  const error = new Error("Setting the value of 'hooshyar.offline.ingest.queue.v1' exceeded the quota.") as Error & { name: string };
  error.name = "QuotaExceededError";
  return error;
};

describe("product.offline-sync client transport (K2)", () => {
  test("enqueue persists work before any network attempt and survives a new instance", async () => {
    const storage = memoryStorage();
    const neverFetch = async () => { throw new Error("network-must-not-be-called-by-enqueue"); };
    const first = createOfflineSync({ storage, fetchImpl: neverFetch, now: () => 1000 });
    const job = await first.enqueue({ sourceName: "offline.csv", format: "CSV", content: "a,b\n1,2" });
    expect(await first.pending()).toHaveLength(1);

    const second = createOfflineSync({ storage, fetchImpl: neverFetch, now: () => 2000 });
    const restored = await second.pending();
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe(job.id);
    expect(restored[0].status).toBe("PENDING");
  });

  test("network loss during sync retains work and never discards it", async () => {
    const storage = memoryStorage();
    const offlineFetch = async () => { throw new TypeError("Failed to fetch"); };
    const sync = createOfflineSync({ storage, fetchImpl: offlineFetch, now: () => 1 });
    await sync.enqueue({ sourceName: "a.csv", format: "CSV", content: "a,b\n1,2" });

    const report = await sync.sync();
    expect(report.status).toBe("OFFLINE");
    expect(report.pending).toBe(1);
    expect(report.synced).toEqual([]);
    expect(report.rejected).toEqual([]);

    const retained = await sync.pending();
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
    const job = await sync.enqueue({ sourceName: "a.csv", format: "CSV", content: "a,b\n1,2", baseWatermark: "wm-old" });

    const report = await sync.sync();
    expect(report.status).toBe("ONLINE");
    expect(report.synced).toEqual([{ id: job.id, sourceKey: "a.csv", watermark: "wm-new", replayed: true }]);
    expect(report.conflicts).toEqual([]);
    expect(await sync.pending()).toEqual([]);

    const ingestCall = calls.find(call => call.url === "/api/ingest");
    expect(ingestCall?.init.headers?.["idempotency-key"]).toBe(job.idempotencyKey);
  });

  test("a server advance while offline is detected and resolved server-authoritative", async () => {
    const { fetchImpl } = routeFetch({
      state: () => makeResponse(200, { status: "READY", cursor: { lastWatermark: "server-2" } }),
      ingest: () => makeResponse(201, { status: "READY", source: { sha256: "wm-3" } }),
    });
    const sync = createOfflineSync({ storage: memoryStorage(), fetchImpl, now: () => 9 });
    const job = await sync.enqueue({ sourceName: "a.csv", format: "CSV", content: "a,b\n1,2", baseWatermark: "base-1" });

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
    expect(await sync.pending()).toEqual([]);
  });

  test("a non-transient rejection is surfaced and not silently retried", async () => {
    const { fetchImpl } = routeFetch({
      state: () => makeResponse(200, { status: "READY", cursor: null }),
      ingest: () => makeResponse(422, { error: "ingestion-json-parse-error" }),
    });
    const sync = createOfflineSync({ storage: memoryStorage(), fetchImpl, now: () => 3 });
    const job = await sync.enqueue({ sourceName: "bad.json", format: "STRUCTURED", content: "{not-json" });

    const report = await sync.sync();
    expect(report.rejected).toEqual([{ id: job.id, sourceKey: "bad.json", error: "ingestion-json-parse-error" }]);
    expect(report.synced).toEqual([]);
    expect(await sync.pending()).toEqual([]);
  });

  test("a transient server failure keeps the job pending for retry", async () => {
    const { fetchImpl } = routeFetch({
      state: () => makeResponse(200, { status: "READY", cursor: null }),
      ingest: () => makeResponse(429, { error: "RATE_LIMIT_EXCEEDED" }),
    });
    const sync = createOfflineSync({ storage: memoryStorage(), fetchImpl, now: () => 4 });
    await sync.enqueue({ sourceName: "a.csv", format: "CSV", content: "a,b\n1,2" });

    const report = await sync.sync();
    expect(report.pending).toBe(1);
    expect(report.synced).toEqual([]);
    expect(report.rejected).toEqual([]);
    expect((await sync.pending())[0].lastError).toBe("RATE_LIMIT_EXCEEDED");
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

describe("product.offline-sync failure taxonomy (K8)", () => {
  test("maps source names to canonical format identifiers", () => {
    expect(formatFromSourceName("ledger.csv")).toBe("CSV");
    expect(formatFromSourceName("ledger.json")).toBe("STRUCTURED");
    expect(formatFromSourceName("ledger.txt")).toBe("TXT");
    expect(formatFromSourceName("ledger.xlsx")).toBe("XLSX");
    expect(formatFromSourceName("statement.PDF")).toBe("PDF");
    expect(formatFromSourceName("scan.docx")).toBe("DOCX");
    expect(formatFromSourceName("photo.png")).toBe("IMAGE");
    expect(formatFromSourceName("no-extension")).toBeNull();
    expect(formatFromSourceName("archive.zip")).toBeNull();
  });

  test("classifies binary vs text formats", () => {
    expect(isBinaryFormat("XLSX")).toBe(true);
    expect(isBinaryFormat("PDF")).toBe(true);
    expect(isBinaryFormat("DOCX")).toBe(true);
    expect(isBinaryFormat("IMAGE")).toBe(true);
    expect(isBinaryFormat("CSV")).toBe(false);
    expect(isBinaryFormat("STRUCTURED")).toBe(false);
    expect(isBinaryFormat("TXT")).toBe(false);
  });

  test("classifies HTTP statuses precisely", () => {
    expect(classifyHttpStatus(401)).toBe(FAILURE_KINDS.AUTHENTICATION_FAILURE);
    expect(classifyHttpStatus(403)).toBe(FAILURE_KINDS.AUTHORIZATION_FAILURE);
    expect(classifyHttpStatus(400)).toBe(FAILURE_KINDS.VALIDATION_FAILURE);
    expect(classifyHttpStatus(422)).toBe(FAILURE_KINDS.VALIDATION_FAILURE);
    expect(classifyHttpStatus(500)).toBe(FAILURE_KINDS.HTTP_5XX);
    expect(classifyHttpStatus(503)).toBe(FAILURE_KINDS.HTTP_5XX);
    expect(classifyHttpStatus(418)).toBe(FAILURE_KINDS.HTTP_4XX);
  });

  test("only genuine connectivity failures may enter the offline queue", () => {
    const network = Object.assign(new Error("offline-network-failure"), { kind: FAILURE_KINDS.NETWORK_FAILURE });
    expect(isConnectivityFailure(network)).toBe(true);
    expect(isConnectivityFailure(FAILURE_KINDS.OFFLINE)).toBe(true);
    expect(isConnectivityFailure(FAILURE_KINDS.VALIDATION_FAILURE)).toBe(false);
    expect(isConnectivityFailure(FAILURE_KINDS.STORAGE_QUOTA_FAILURE)).toBe(false);
    expect(isConnectivityFailure(FAILURE_KINDS.AUTHENTICATION_FAILURE)).toBe(false);
  });

  test("a generic TypeError is NOT connectivity merely because it is a TypeError", () => {
    const kind = classifyFailure(new TypeError("file.text is not a function"));
    expect(kind).toBe(FAILURE_KINDS.APPLICATION_FAILURE);
    expect(isConnectivityFailure(new TypeError("boom"))).toBe(false);
  });

  test("QuotaExceededError is a storage failure, never offline", () => {
    const error = quotaError();
    expect(isQuotaError(error)).toBe(true);
    const kind = classifyFailure(error);
    expect(kind).toBe(FAILURE_KINDS.STORAGE_QUOTA_FAILURE);
    expect(isConnectivityFailure(kind)).toBe(false);
  });

  test("an explicitly tagged file-representation failure stays non-connectivity", () => {
    const error = Object.assign(new Error("unknown-file-format:x.zip"), { kind: FAILURE_KINDS.FILE_REPRESENTATION_FAILURE });
    expect(classifyFailure(error)).toBe(FAILURE_KINDS.FILE_REPRESENTATION_FAILURE);
    expect(isConnectivityFailure(error)).toBe(false);
  });
});

describe("product.offline-sync durable bounded storage (K8)", () => {
  const quotaStorage = () => {
    const base = memoryStorage();
    let blocked = false;
    return {
      setBlocked: (value: boolean) => { blocked = value; },
      storage: {
        getItem: (key: string) => base.getItem(key),
        removeItem: (key: string) => base.removeItem(key),
        setItem: (key: string, value: string) => {
          if (blocked) throw quotaError();
          base.setItem(key, value);
        },
      },
    };
  };

  test("a quota failure surfaces a typed error and preserves previously queued work", async () => {
    const { setBlocked, storage } = quotaStorage();
    const sync = createOfflineSync({ storage, fetchImpl: async () => { throw new Error("unused"); }, now: () => 1 });
    await sync.enqueue({ sourceName: "first.csv", format: "CSV", content: "a,b\n1,2" });

    setBlocked(true);
    await expect(sync.enqueue({ sourceName: "second.xlsx", format: "XLSX", contentBase64: "AAAA" }))
      .rejects.toMatchObject({ kind: FAILURE_KINDS.STORAGE_QUOTA_FAILURE });

    setBlocked(false);
    const retained = await sync.pending();
    expect(retained).toHaveLength(1);
    expect(retained[0].sourceName).toBe("first.csv");
  });

  test("a non-quota storage failure is typed STORAGE_FAILURE and does not lose work", async () => {
    const base = memoryStorage();
    let failWrites = false;
    const storage = {
      getItem: (key: string) => base.getItem(key),
      removeItem: (key: string) => base.removeItem(key),
      setItem: (key: string, value: string) => {
        if (failWrites) throw new Error("disk-unavailable");
        base.setItem(key, value);
      },
    };
    const sync = createOfflineSync({ storage, fetchImpl: async () => { throw new Error("unused"); } });
    await sync.enqueue({ sourceName: "kept.csv", format: "CSV", content: "a,b\n1,2" });
    failWrites = true;
    await expect(sync.enqueue({ sourceName: "lost.csv", format: "CSV", content: "a,b\n3,4" }))
      .rejects.toMatchObject({ kind: FAILURE_KINDS.STORAGE_FAILURE });
    failWrites = false;
    expect(await sync.pending()).toHaveLength(1);
  });

  test("an oversized job is rejected before it can exhaust browser storage", async () => {
    const sync = createOfflineSync({ storage: memoryStorage(), fetchImpl: async () => { throw new Error("unused"); }, maxJobBytes: 128 });
    await expect(sync.enqueue({ sourceName: "huge.xlsx", format: "XLSX", contentBase64: "A".repeat(1024) }))
      .rejects.toMatchObject({ kind: FAILURE_KINDS.STORAGE_QUOTA_FAILURE });
    expect(await sync.pending()).toEqual([]);
  });

  test("the queue is bounded and reports capacity exhaustion instead of dropping work", async () => {
    const sync = createOfflineSync({ storage: memoryStorage(), fetchImpl: async () => { throw new Error("unused"); }, maxJobs: 1 });
    await sync.enqueue({ sourceName: "one.csv", format: "CSV", content: "a,b\n1,2" });
    await expect(sync.enqueue({ sourceName: "two.csv", format: "CSV", content: "a,b\n3,4" }))
      .rejects.toMatchObject({ kind: FAILURE_KINDS.STORAGE_FAILURE });
    expect(await sync.pending()).toHaveLength(1);
  });

  test("a queued binary payload survives a reload byte-for-byte", async () => {
    const storage = memoryStorage();
    const base64 = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0xfe, 0x00, 0x01]).toString("base64");
    const first = createOfflineSync({ storage, fetchImpl: async () => { throw new Error("unused"); } });
    await first.enqueue({ sourceName: "binary.xlsx", format: "XLSX", contentBase64: base64 });

    const second = createOfflineSync({ storage, fetchImpl: async () => { throw new Error("unused"); } });
    const restored = await second.pending();
    expect(restored).toHaveLength(1);
    expect(restored[0].format).toBe("XLSX");
    expect(Buffer.from(restored[0].contentBase64, "base64")).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0xfe, 0x00, 0x01]));
  });
});
