import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";
import { FinancialDataIngestionAdapter } from "../Product/FinancialDataIngestionAdapter";
import { FinancialStatementAnalysisService } from "../Product/FinancialStatementAnalysisService";

test("financial vertical uses canonical ingestion output for intelligence and analysis", async () => {
  const persistence = { write: jest.fn().mockResolvedValue(undefined) } as any;
  const intelligence = new FinancialIntelligenceEngine();
  const adapter = new FinancialDataIngestionAdapter(persistence, intelligence);

  const ingestion = await adapter.ingestCsv(
    "tenant-1",
    "statement.csv",
    [
      "date,account,debit,credit,currency",
      "2026-01-01,Sales,0,1000,IRR",
      "2026-01-01,Expense,400,0,IRR",
    ].join("\n"),
  );

  expect(ingestion.intelligence.status).toBe("READY");
  expect(ingestion.intelligence.revenue).toBe(1000);
  expect(ingestion.intelligence.expenses).toBe(400);

  const reasoning = { reason: jest.fn().mockReturnValue({ status: "READY", success: true }) } as any;
  const service = new FinancialStatementAnalysisService(intelligence, reasoning);
  const result = service.execute({
    tenantId: "tenant-1",
    source: ingestion.evidence,
    revenue: 0,
    expenses: 0,
    assets: 1,
    liabilities: 0,
    ingestion,
  });

  expect(result.status).toBe("READY");
  expect(result.metrics.profit).toBe(600);
  expect(result.source).toBe(ingestion.model.source);
});
