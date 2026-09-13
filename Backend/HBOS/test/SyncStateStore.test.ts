/**
 * Stage 08-GOV.3 — Sync State Store tests.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { SyncStateStore, SYNC_STATE_ERROR_CODES } from "../Product/SyncStateStore";

describe("SyncStateStore (Stage 08-GOV.3)", () => {
  let directory: string;
  let store: SQLitePersistenceStore;
  let sync: SyncStateStore;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "hooshyar-sync-"));
    store = new SQLitePersistenceStore({ databasePath: join(directory, "s.db") });
    sync = new SyncStateStore(store);
  });
  afterEach(() => {
    try { store.close(); } catch {}
    try { rmSync(directory, { recursive: true, force: true }); } catch {}
  });

  test("get returns null for unknown source", async () => {
    expect(await sync.get("t1", "src")).toBeNull();
  });

  test("recordSuccess then get returns the cursor", async () => {
    const cur = await sync.recordSuccess("t1", "src", "2026-09-01");
    expect(cur.lastWatermark).toBe("2026-09-01");
    expect(cur.lastSuccessAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const back = await sync.get("t1", "src");
    expect(back).toEqual(cur);
  });

  test("recordError retains previous watermark + adds lastError", async () => {
    await sync.recordSuccess("t1", "src", "wm-1");
    const err = await sync.recordError("t1", "src", "boom");
    expect(err.lastWatermark).toBe("wm-1");
    expect(err.lastError).toBe("boom");
    expect(err.lastErrorAt).toBeDefined();
  });

  test("recordError before any success has empty watermark", async () => {
    const err = await sync.recordError("t1", "src", "boom");
    expect(err.lastWatermark).toBe("");
    expect(err.lastError).toBe("boom");
  });

  test("cross-tenant isolation: t2 cannot read t1's cursor", async () => {
    await sync.recordSuccess("t1", "src", "wm-1");
    expect(await sync.get("t2", "src")).toBeNull();
  });

  test("rejects empty tenant and source", async () => {
    await expect(sync.get("", "src")).rejects.toThrow(SYNC_STATE_ERROR_CODES.TENANT_REQUIRED);
    await expect(sync.get("t1", "")).rejects.toThrow(SYNC_STATE_ERROR_CODES.SOURCE_REQUIRED);
    await expect(sync.recordSuccess("", "src", "w")).rejects.toThrow(SYNC_STATE_ERROR_CODES.TENANT_REQUIRED);
    await expect(sync.recordSuccess("t1", "", "w")).rejects.toThrow(SYNC_STATE_ERROR_CODES.SOURCE_REQUIRED);
    await expect(sync.recordError("", "src", "x")).rejects.toThrow(SYNC_STATE_ERROR_CODES.TENANT_REQUIRED);
    await expect(sync.recordError("t1", "", "x")).rejects.toThrow(SYNC_STATE_ERROR_CODES.SOURCE_REQUIRED);
  });

  test("rejects construction with missing store", () => {
    expect(() => new SyncStateStore(undefined as unknown as SQLitePersistenceStore))
      .toThrow(SYNC_STATE_ERROR_CODES.STORE_REQUIRED);
  });

  test("durability: cursor survives store reopen", async () => {
    await sync.recordSuccess("t1", "src", "wm-durable");
    store.close();
    const store2 = new SQLitePersistenceStore({ databasePath: join(directory, "s.db") });
    const sync2 = new SyncStateStore(store2);
    const back = await sync2.get("t1", "src");
    expect(back?.lastWatermark).toBe("wm-durable");
    store2.close();
  });
});