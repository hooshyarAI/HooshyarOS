/**
 * Stage 08-AUTO.2 — Change Detection / Incremental Ingest tests.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { FinancialDataIngestionAdapter } from "../Product/FinancialDataIngestionAdapter";
import { IncrementalIngestGate, INCREMENTAL_ERROR_CODES } from "../Product/IncrementalIngest";

const CSV = "date,account,debit,credit,currency\n2026-08-01,Cash,100,0,IRR\n2026-08-01,Sales,0,100,IRR";

describe("IncrementalIngestGate (Stage 08-AUTO.2)", () => {
  let directory: string;
  let store: SQLitePersistenceStore;
  let adapter: FinancialDataIngestionAdapter;
  let gate: IncrementalIngestGate;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "hooshyar-incr-"));
    store = new SQLitePersistenceStore({ databasePath: join(directory, "s.db") });
    adapter = new FinancialDataIngestionAdapter(store);
    gate = new IncrementalIngestGate(adapter);
  });
  afterEach(() => {
    try { store.close(); } catch {}
    try { rmSync(directory, { recursive: true, force: true }); } catch {}
  });

  test("first ingest produces sourceVersion=1 and previousSha256=null", async () => {
    const p = join(directory, "ledger.csv");
    writeFileSync(p, CSV);
    const out = await gate.ingest({ tenantId: "t1", sourcePath: p });
    expect(out.status).toBe("ingested");
    expect(out.sourceVersion).toBe(1);
    expect(out.previousSha256).toBeNull();
    expect(out.currentSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  test("unchanged content short-circuits to status=unchanged", async () => {
    const p = join(directory, "ledger.csv");
    writeFileSync(p, CSV);
    await gate.ingest({ tenantId: "t1", sourcePath: p });
    const out = await gate.ingest({ tenantId: "t1", sourcePath: p });
    expect(out.status).toBe("unchanged");
    expect(out.sourceVersion).toBe(1); // not bumped
    expect(out.previousSha256).toBe(out.currentSha256);
  });

  test("changed content bumps sourceVersion and records previousSha256", async () => {
    const p = join(directory, "ledger.csv");
    writeFileSync(p, CSV);
    const first = await gate.ingest({ tenantId: "t1", sourcePath: p });
    writeFileSync(p, CSV + "\n2026-08-02,Cash,50,0,IRR\n2026-08-02,Sales,0,50,IRR");
    const second = await gate.ingest({ tenantId: "t1", sourcePath: p });
    expect(second.status).toBe("ingested");
    expect(second.sourceVersion).toBe(first.sourceVersion + 1);
    expect(second.previousSha256).toBe(first.currentSha256);
  });

  test("force=true re-ingests even when content unchanged", async () => {
    const p = join(directory, "ledger.csv");
    writeFileSync(p, CSV);
    const first = await gate.ingest({ tenantId: "t1", sourcePath: p });
    const forced = await gate.ingest({ tenantId: "t1", sourcePath: p, options: { force: true } });
    expect(forced.status).toBe("ingested");
    expect(forced.sourceVersion).toBe(first.sourceVersion + 1);
  });

  test("tenant isolation: different tenants do not see each other's state", async () => {
    const p = join(directory, "ledger.csv");
    writeFileSync(p, CSV);
    const t1 = await gate.ingest({ tenantId: "t1", sourcePath: p });
    const t2 = await gate.ingest({ tenantId: "t2", sourcePath: p });
    expect(t1.sourceVersion).toBe(1);
    expect(t2.sourceVersion).toBe(1);
    expect(t2.previousSha256).toBeNull();
  });

  test("rejects empty tenant and empty path", async () => {
    const p = join(directory, "x.csv");
    writeFileSync(p, CSV);
    await expect(gate.ingest({ tenantId: "", sourcePath: p }))
      .rejects.toThrow(INCREMENTAL_ERROR_CODES.TENANT_REQUIRED);
    await expect(gate.ingest({ tenantId: "t1", sourcePath: "" }))
      .rejects.toThrow(INCREMENTAL_ERROR_CODES.PATH_REQUIRED);
  });

  test("reset clears per-tenant state", async () => {
    const p = join(directory, "ledger.csv");
    writeFileSync(p, CSV);
    const first = await gate.ingest({ tenantId: "t1", sourcePath: p });
    gate.reset("t1");
    const after = await gate.ingest({ tenantId: "t1", sourcePath: p });
    expect(after.previousSha256).toBeNull();
    expect(after.sourceVersion).toBe(1); // reset wipes state, restarts at 1
  });

  test("isChanged helper", () => {
    expect(IncrementalIngestGate.isChanged("abc", null)).toBe(true);
    expect(IncrementalIngestGate.isChanged("abc", "abc")).toBe(false);
    expect(IncrementalIngestGate.isChanged("abc", "def")).toBe(true);
  });
});