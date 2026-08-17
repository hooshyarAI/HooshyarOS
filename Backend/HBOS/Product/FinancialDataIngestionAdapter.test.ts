import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SQLitePersistenceStore } from "./SQLitePersistenceStore";
import { FinancialDataIngestionAdapter } from "./FinancialDataIngestionAdapter";

const SOURCE = `date,account,debit,credit,currency\n2026-08-01,Cash,1000,0,IRR\n2026-08-01,Sales,0,1000,IRR\n2026-08-02,Receivable,250,0,IRR\n2026-08-02,Sales,0,250,IRR`;

describe("FinancialDataIngestionAdapter", () => {
  let directory: string;

  beforeEach(() => { directory = mkdtempSync(join(tmpdir(), "hooshyar-financial-ingestion-")); });
  afterEach(() => { rmSync(directory, { recursive: true, force: true }); });

  test("ingests real CSV source evidence into canonical tenant-scoped data and persists it", async () => {
    const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
    const adapter = new FinancialDataIngestionAdapter(database);

    const result = await adapter.ingestCsv("tenant-a", "sample-ledger.csv", SOURCE);

    expect(result.persisted).toBe(true);
    expect(result.evidence.sourceName).toBe("sample-ledger.csv");
    expect(result.evidence.sha256).toHaveLength(64);
    expect(result.model.tenantId).toBe("tenant-a");
    expect(result.model.transactions).toHaveLength(4);
    expect(result.model.totals).toEqual({ debit: 1250, credit: 1250, balance: 0 });

    const persisted = await database.read(
      { tenantId: "tenant-a" },
      `financial-ingestion:${result.evidence.sha256}`,
    );
    expect(persisted?.value).toEqual(result.model);
    database.close();
  });

  test("keeps financial data tenant-scoped", async () => {
    const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
    const adapter = new FinancialDataIngestionAdapter(database);
    const result = await adapter.ingestCsv("tenant-a", "ledger.csv", SOURCE);

    await expect(database.read(
      { tenantId: "tenant-b" },
      `financial-ingestion:${result.evidence.sha256}`,
    )).resolves.toBeNull();
    database.close();
  });

  test("rejects invalid financial rows before persistence", async () => {
    const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
    const adapter = new FinancialDataIngestionAdapter(database);
    const invalid = `date,account,debit,credit,currency\n2026-08-01,Cash,100,50,IRR`;

    await expect(adapter.ingestCsv("tenant-a", "bad.csv", invalid)).rejects.toThrow(
      "ingestion-double-sided-row:2",
    );
    database.close();
  });
});
