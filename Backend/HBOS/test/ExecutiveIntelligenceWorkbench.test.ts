import { ExecutiveIntelligenceEngine } from "../Engines/ExecutiveIntelligenceEngine";
import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";
import { ExecutiveIntelligenceWorkbench } from "../Product/ExecutiveIntelligenceWorkbench";

describe("ExecutiveIntelligenceWorkbench", () => {
  const metrics = new FinancialIntelligenceEngine().analyze({
    revenue: 1000,
    expenses: 600,
    assets: 2000,
    liabilities: 500,
  });

  it("composes verified financial evidence into four executive KPIs", () => {
    const workbench = new ExecutiveIntelligenceWorkbench(new ExecutiveIntelligenceEngine());
    const result = workbench.execute({
      tenantId: "tenant:qa",
      metrics,
      targets: { revenue: 900, profit: 350, profitMargin: 0.3, debtRatio: 0.4 },
    });

    expect(result.status).toBe("READY");
    expect(result.kpis).toHaveLength(4);
    expect(result.kpis[0]).toEqual(expect.objectContaining({ name: "revenue", actual: 1000, target: 900 }));
    expect(result.kpis[1]).toEqual(expect.objectContaining({ name: "profit", actual: 400, target: 350 }));
    expect(result.recommendations.every((recommendation) => recommendation.status !== "BLOCKED")).toBe(true);
  });

  it("fails closed when a KPI target is invalid", () => {
    const workbench = new ExecutiveIntelligenceWorkbench(new ExecutiveIntelligenceEngine());
    expect(() => workbench.execute({
      tenantId: "tenant:qa",
      metrics,
      targets: { revenue: 900, profit: 350, profitMargin: 0, debtRatio: 0.4 },
    })).toThrow("executive-intelligence-workbench-targets-invalid");
  });

  it("preserves the tenant boundary", () => {
    const workbench = new ExecutiveIntelligenceWorkbench(new ExecutiveIntelligenceEngine());
    const result = workbench.execute({
      tenantId: "tenant:isolated",
      metrics,
      targets: { revenue: 900, profit: 350, profitMargin: 0.3, debtRatio: 0.4 },
    });
    expect(result.tenantId).toBe("tenant:isolated");
  });
});
