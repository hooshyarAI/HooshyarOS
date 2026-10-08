/**
 * Stage 08-DOC.1 — TXT Acquisition focused tests.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { FinancialDataIngestionAdapter } from "../Product/FinancialDataIngestionAdapter";

const CSV = "date,account,debit,credit,currency\n2026-08-01,Cash,1000,0,IRR\n2026-08-01,Sales,0,1000,IRR\n";

describe("TXT Acquisition (Stage 08-DOC.1)", () => {
  let directory: string;
  let store: SQLitePersistenceStore;
  let adapter: FinancialDataIngestionAdapter;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "hooshyar-txt-"));
    store = new SQLitePersistenceStore({ databasePath: join(directory, "s.db") });
    adapter = new FinancialDataIngestionAdapter(store);
  });

  afterEach(() => {
    try { store.close(); } catch {}
    try { rmSync(directory, { recursive: true, force: true }); } catch {}
  });

  test("ingests a UTF-8 (no BOM) .txt file", async () => {
    const p = join(directory, "ledger.txt");
    writeFileSync(p, CSV, "utf8");
    const result = await adapter.ingestFile("t1", p);
    expect(result.model.transactions).toHaveLength(2);
    expect(result.persisted).toBe(true);
  });

  test("ingests a UTF-8 BOM .txt file", async () => {
    const p = join(directory, "ledger-bom.txt");
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    writeFileSync(p, Buffer.concat([bom, Buffer.from(CSV, "utf8")]));
    const result = await adapter.ingestFile("t1", p);
    expect(result.model.transactions).toHaveLength(2);
  });

  test("ingests a UTF-16 LE BOM .txt file", async () => {
    const p = join(directory, "ledger-le.txt");
    const bom = Buffer.from([0xff, 0xfe]);
    writeFileSync(p, Buffer.concat([bom, Buffer.from(CSV, "utf16le")]));
    const result = await adapter.ingestFile("t1", p);
    expect(result.model.transactions).toHaveLength(2);
  });

  test("ingests a UTF-16 BE BOM .txt file", async () => {
    const p = join(directory, "ledger-be.txt");
    const bom = Buffer.from([0xfe, 0xff]);
    // write the content as utf16le then swap to BE
    const le = Buffer.from(CSV, "utf16le");
    le.swap16();
    writeFileSync(p, Buffer.concat([bom, le]));
    const result = await adapter.ingestFile("t1", p);
    expect(result.model.transactions).toHaveLength(2);
  });

  test("rejects a .txt that does not match the 5-column CSV schema", async () => {
    const p = join(directory, "garbage.txt");
    writeFileSync(p, "not,a,csv,ledger\nfoo,bar\n", "utf8");
    await expect(adapter.ingestFile("t1", p)).rejects.toThrow(/ingestion-schema-invalid/);
  });

  test("rejects an empty .txt file", async () => {
    const p = join(directory, "empty.txt");
    writeFileSync(p, "", "utf8");
    await expect(adapter.ingestFile("t1", p)).rejects.toThrow(/ingestion-source-empty/);
  });
});
