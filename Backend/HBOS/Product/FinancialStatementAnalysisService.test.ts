import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";
import { FinancialDataIngestionAdapter } from "./FinancialDataIngestionAdapter";
import { SQLitePersistenceStore } from "./SQLitePersistenceStore";
import { FinancialStatementAnalysisService } from "./FinancialStatementAnalysisService";

describe("FinancialStatementAnalysisService production behavioral evidence", () => {
  test("turns ingested financial data into a customer-usable verified result", async () => {
    const persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
    const ingestion = new FinancialDataIngestionAdapter(persistence);
    const source = "date,account,debit,credit,currency\n2026-08-01,Cash,1000,0,IRR\n2026-08-01,Sales,0,1000,IRR";
    const ingested = await ingestion.ingestCsv("tenant-a", "ledger.csv", source);

    const reasoning = {
      reason: (problem: string) => ({ problem, status: "verified", success: true as const }),
    };
    const service = new FinancialStatementAnalysisService(new FinancialIntelligenceEngine(), reasoning);
    const result = service.execute({
      tenantId: "tenant-a",
      revenue: ingested.model.totals.credit,
      expenses: ingested.model.totals.debit,
      assets: 1000,
      liabilities: 250,
      source: ingested.evidence,
    });

    expect(result.status).toBe("READY");
    expect(result.tenantId).toBe("tenant-a");
    expect(result.metrics.profit).toBe(0);
    expect(result.metrics.debtRatio).toBe(0.25);
    expect(result.observations[0]).toMatchObject({ code: "PROFITABLE" });
    expect(result.reasoningEvidence).toEqual({ status: "verified", success: true });
    expect(result.source.sha256).toBe(ingested.evidence.sha256);
    persistence.close();
  });

  test("fails closed when source provenance is invalid", () => {
    const service = new FinancialStatementAnalysisService(
      new FinancialIntelligenceEngine(),
      { reason: () => ({ problem: "", status: "verified", success: true }) },
    );

    expect(() => service.execute({
      tenantId: "tenant-a",
      revenue: 100,
      expenses: 50,
      assets: 100,
      liabilities: 20,
      source: { sourceName: "ledger.csv", sourceType: "CSV", sha256: "invalid", receivedAt: new Date().toISOString() },
    })).toThrow("financial-statement-analysis-source-evidence-invalid");
  });
});
