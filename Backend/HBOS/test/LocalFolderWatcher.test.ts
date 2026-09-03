/**
 * Stage 08-AUTO.1 — Local Folder Watcher tests.
 */
import { mkdtempSync, rmSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { FinancialDataIngestionAdapter } from "../Product/FinancialDataIngestionAdapter";
import { LocalFolderWatcher, WATCHER_ERROR_CODES } from "../Product/LocalFolderWatcher";

describe("LocalFolderWatcher (Stage 08-AUTO.1)", () => {
  let directory: string;
  let store: SQLitePersistenceStore;
  let adapter: FinancialDataIngestionAdapter;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "hooshyar-watch-"));
    store = new SQLitePersistenceStore({ databasePath: join(directory, "s.db") });
    adapter = new FinancialDataIngestionAdapter(store);
  });
  afterEach(() => {
    try { store.close(); } catch {}
    try { rmSync(directory, { recursive: true, force: true }); } catch {}
  });

  test("rejects empty tenant", () => {
    expect(() => new LocalFolderWatcher({
      tenantId: "", folder: directory, adapter, handler: () => undefined,
    })).toThrow(WATCHER_ERROR_CODES.TENANT_REQUIRED);
  });

  test("rejects empty folder", () => {
    expect(() => new LocalFolderWatcher({
      tenantId: "t", folder: "", adapter, handler: () => undefined,
    })).toThrow(WATCHER_ERROR_CODES.PATH_REQUIRED);
  });

  test("start / stop lifecycle", async () => {
    const w = new LocalFolderWatcher({
      tenantId: "t", folder: directory, adapter,
      handler: () => undefined, options: { scanIntervalMs: 60_000 },
    });
    await w.start();
    expect(w.isRunning).toBe(true);
    await w.stop();
    expect(w.isRunning).toBe(false);
  });

  test("start fails when folder is not a directory", async () => {
    const file = join(directory, "not-a-dir");
    writeFileSync(file, "x");
    const w = new LocalFolderWatcher({
      tenantId: "t", folder: file, adapter, handler: () => undefined,
    });
    await expect(w.start()).rejects.toThrow(/not-a-directory/);
  });

  test("start fails when already running", async () => {
    const w = new LocalFolderWatcher({
      tenantId: "t", folder: directory, adapter,
      handler: () => undefined, options: { scanIntervalMs: 60_000 },
    });
    await w.start();
    await expect(w.start()).rejects.toThrow(WATCHER_ERROR_CODES.ALREADY_RUNNING);
    await w.stop();
  });

  test("stop fails when not running", async () => {
    const w = new LocalFolderWatcher({
      tenantId: "t", folder: directory, adapter, handler: () => undefined,
    });
    await expect(w.stop()).rejects.toThrow(WATCHER_ERROR_CODES.NOT_RUNNING);
  });

  test("ignores transient / hidden / lock files", async () => {
    const events: string[] = [];
    const w = new LocalFolderWatcher({
      tenantId: "t", folder: directory, adapter,
      handler: (e) => { events.push(e.sourceName); },
      options: { debounceMs: 25, scanIntervalMs: 60_000 },
    });
    await w.start();
    writeFileSync(join(directory, "~$lock.xlsx"), "x");
    writeFileSync(join(directory, ".hidden.csv"), "x");
    writeFileSync(join(directory, "partial.tmp"), "x");
    writeFileSync(join(directory, "real.csv"), "date,account,debit,credit,currency\n2026-08-01,Cash,1,0,IRR");
    await new Promise((r) => setTimeout(r, 100));
    await w.stop();
    expect(events).toEqual(["real.csv"]);
  });

  test("emits add for new files and change for existing", async () => {
    const events: Array<{ name: string; kind: string }> = [];
    const w = new LocalFolderWatcher({
      tenantId: "t", folder: directory, adapter,
      handler: (e) => { events.push({ name: e.sourceName, kind: e.event }); },
      options: { debounceMs: 25, scanIntervalMs: 60_000 },
    });
    await w.start();
    const p = join(directory, "ledger.csv");
    writeFileSync(p, "date,account,debit,credit,currency\n2026-08-01,Cash,1,0,IRR");
    await new Promise((r) => setTimeout(r, 80));
    // Re-write with new mtime to trigger change
    await new Promise((r) => setTimeout(r, 20));
    writeFileSync(p, "date,account,debit,credit,currency\n2026-08-01,Cash,2,0,IRR");
    const future = (Date.now() + 2000) / 1000;
    utimesSync(p, future, future);
    await new Promise((r) => setTimeout(r, 150));
    await w.stop();
    const ledgerEvents = events.filter((e) => e.name === "ledger.csv");
    expect(ledgerEvents.length).toBeGreaterThanOrEqual(1);
    expect(ledgerEvents[0].kind).toBe("add");
  });

  test("ingest() routes through the adapter (CSV path)", async () => {
    const w = new LocalFolderWatcher({
      tenantId: "t", folder: directory, adapter, handler: () => undefined,
      options: { scanIntervalMs: 60_000 },
    });
    await w.start();
    const p = join(directory, "manual.csv");
    writeFileSync(p, "date,account,debit,credit,currency\n2026-08-01,Cash,1,0,IRR");
    const result = await w.ingest(p) as { model: { transactions: unknown[] } };
    expect(result.model.transactions).toHaveLength(1);
    await w.stop();
  });
});