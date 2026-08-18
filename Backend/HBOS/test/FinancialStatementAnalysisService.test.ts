import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";
import { FinancialSourceEvidence } from "../Product/FinancialDataIngestionAdapter";
import { FinancialStatementAnalysisService } from "../Product/FinancialStatementAnalysisService";

describe("FinancialStatementAnalysisService", () => {
  const source: FinancialSourceEvidence = {
    sourceName: "statement.csv",
    sourceType: "CSV",
    sha256: "a".repeat(64),
    receivedAt: "2026-08-18T00:00:00.000Z",
  };

  const reasoning = {
    reason: jest.fn(() => ({
      problem: "financial analysis",
      status: "reasoned",
      success: true,
    })),
  };

  const input = {
    tenantId: "tenant-a",
    source,
    revenue: 1000,
    expenses: 700,
    assets: 2000,
    liabilities: 500,
  };

  const service = () =>
    new FinancialStatementAnalysisService(new FinancialIntelligenceEngine(), reasoning);

  beforeEach(() => jest.clearAllMocks());

  it("composes the canonical financial engine and preserves verified source evidence", () => {
    const result = service().execute(input);

    expect(result.status).toBe("READY");
    expect(result.capabilityId).toBe("product.financial-statement-analysis");
    expect(result.targetEngine).toBe("Financial Intelligence Engine");
    expect(result.tenantId).toBe("tenant-a");
    expect(result.source).toEqual(source);
    expect(result.metrics).toEqual({
      revenue: 1000,
      expenses: 700,
      profit: 300,
      profitMargin: 0.3,
      debtRatio: 0.25,
      status: "READY",
    });
    expect(result.observations).toEqual([
      { code: "PROFITABLE", message: "The analyzed statement has non-negative profit." },
    ]);
    expect(result.reasoningEvidence).toEqual({ status: "reasoned", success: true });
    expect(reasoning.reason).toHaveBeenCalledTimes(1);
    expect(reasoning.reason.mock.calls[0][0]).toContain("do not invent thresholds or business rules");
  });

  it("reports a loss without introducing a policy threshold", () => {
    const result = service().execute({
      ...input,
      revenue: 1000,
      expenses: 1200,
    });

    expect(result.status).toBe("READY");
    expect(result.metrics.profit).toBe(-200);
    expect(result.observations).toEqual([
      { code: "LOSS", message: "The analyzed statement has negative profit." },
    ]);
  });

  it("fails closed when the reasoning boundary cannot produce evidence", () => {
    const blockedReasoning = {
      reason: jest.fn(() => ({ problem: "x", status: "reasoning_failed", success: false })),
    };

    const blocked = new FinancialStatementAnalysisService(
      new FinancialIntelligenceEngine(),
      blockedReasoning,
    ).execute(input);

    expect(blocked.status).toBe("BLOCKED");
    expect(blocked.reasoningEvidence).toEqual({ status: "reasoning_failed", success: false });
    expect(blocked.observations).toEqual([]);
  });

  it("delegates financial-input validity to the canonical financial engine", () => {
    const result = service().execute({
      ...input,
      revenue: Number.NaN,
    });

    expect(result.status).toBe("BLOCKED");
    expect(result.metrics.status).toBe("BLOCKED");
    expect(result.reasoningEvidence).toEqual({
      status: "financial-analysis-blocked",
      success: false,
    });
    expect(reasoning.reason).not.toHaveBeenCalled();
  });

  it("rejects missing tenant or invalid source provenance at the product boundary", () => {
    expect(() => service().execute({ ...input, tenantId: " " })).toThrow(
      "financial-statement-analysis-tenant-required",
    );

    expect(() => service().execute({
      ...input,
      source: { ...source, sha256: "bad" },
    })).toThrow("financial-statement-analysis-source-evidence-invalid");
  });
});
