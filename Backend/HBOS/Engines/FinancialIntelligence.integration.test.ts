import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FinancialDataIngestionAdapter } from "../Product/FinancialDataIngestionAdapter";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";

describe("Financial intelligence integration", () => {
  it("connects canonical CSV ingestion, tenant persistence, and financial analysis", async () => {
    const root = await mkdtemp(join(tmpdir(), "hooshyar-financial-intelligence-"));
    const store = new SQLitePersistenceStore({ databasePath: join(root, "financial.sqlite") });
    try {
      const result = await new FinancialDataIngestionAdapter(store).ingestCsv(
        "tenant-finance",
        "representative.csv",
        "date,account,debit,credit,currency\n2026-01-01,Sales,0,1000,IRR\n2026-01-02,Expense,250,0,IRR\n",
      );
      expect(result.persisted).toBe(true);
      expect(result.model.tenantId).toBe("tenant-finance");
      expect(result.intelligence.status).toBe("READY");
      expect(result.intelligence.revenue).toBe(1000);
      expect(result.intelligence.expenses).toBe(250);
      expect(result.intelligence.profit).toBe(750);
      expect(result.intelligence.profitMargin).toBe(0.75);
      expect(await store.read({ tenantId: "tenant-finance" }, `financial-ingestion:${result.evidence.sha256}`)).not.toBeNull();
    } finally {
      store.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
