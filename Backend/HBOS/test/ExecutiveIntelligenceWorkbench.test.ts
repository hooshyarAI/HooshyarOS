import { ExecutiveIntelligenceEngine } from "../Engines/ExecutiveIntelligenceEngine";
import { ExecutiveIntelligenceWorkbench } from "../Product/ExecutiveIntelligenceWorkbench";

describe("ExecutiveIntelligenceWorkbench", () => {
  it("composes verified metrics into KPI, recommendation and performance evidence", () => {
    const workbench = new ExecutiveIntelligenceWorkbench(new ExecutiveIntelligenceEngine());
    const result = workbench.execute({
      tenantId: "tenant:qa",
      metrics: { revenue: 1500, profit: 1000, profitMargin: 1000 / 1500, debtRatio: 0.4 },
      targets: { revenue: 1400, profit: 900, profitMargin: 0.6, debtRatio: 0.5 },
    });

    expect(result.status).toBe("READY");
    expect(result.tenantId).toBe("tenant:qa");
    expect(result.kpis).toHaveLength(4);
    expect(result.kpis[0]).toEqual(expect.objectContaining({ name: "revenue", variance: 100, achievementRate: expect.any(Number) }));
    expect(result.kpis[1]).toEqual(expect.objectContaining({ name: "profit", variance: 100 }));
    expect(result.recommendations).toHaveLength(4);
    expect(result.performance).toHaveLength(4);
  });

  it("fails closed when tenant, metric or target evidence is invalid", () => {
    const workbench = new ExecutiveIntelligenceWorkbench(new ExecutiveIntelligenceEngine());
    expect(() => workbench.execute({
      tenantId: "",
      metrics: { revenue: 1, profit: 1, profitMargin: 1, debtRatio: 1 },
      targets: { revenue: 1, profit: 1, profitMargin: 1, debtRatio: 1 },
    })).toThrow("executive-intelligence-workbench-tenant-required");

    expect(() => workbench.execute({
      tenantId: "tenant:qa",
      metrics: { revenue: Number.NaN, profit: 1, profitMargin: 1, debtRatio: 1 },
      targets: { revenue: 1, profit: 1, profitMargin: 1, debtRatio: 1 },
    })).toThrow("executive-intelligence-workbench-metric-invalid:revenue");

    expect(() => workbench.execute({
      tenantId: "tenant:qa",
      metrics: { revenue: 1, profit: 1, profitMargin: 1, debtRatio: 1 },
      targets: { revenue: 1, profit: Infinity, profitMargin: 1, debtRatio: 1 },
    })).toThrow("executive-intelligence-workbench-target-invalid:profit");
  });
});
