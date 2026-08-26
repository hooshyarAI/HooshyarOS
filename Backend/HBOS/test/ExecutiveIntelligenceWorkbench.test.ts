import { ExecutiveIntelligenceEngine } from "../Engines/ExecutiveIntelligenceEngine";
import { ExecutiveIntelligenceWorkbench } from "../Product/ExecutiveIntelligenceWorkbench";

describe("ExecutiveIntelligenceWorkbench", () => {
  const workbench = () =>
    new ExecutiveIntelligenceWorkbench(new ExecutiveIntelligenceEngine());

  it("composes verified financial evidence into canonical executive KPIs", () => {
    const result = workbench().execute({
      tenantId: "tenant:qa",
      metrics: {
        revenue: 1500,
        profit: 1000,
        profitMargin: 1000 / 1500,
        debtRatio: 0.4,
      },
      targets: {
        revenue: 1400,
        profit: 900,
        profitMargin: 0.6,
        debtRatio: 0.5,
      },
    });

    expect(result.status).toBe("READY");
    expect(result.tenantId).toBe("tenant:qa");
    expect(result.kpis).toEqual([
      expect.objectContaining({ name: "revenue", actual: 1500, target: 1400, variance: 100 }),
      expect.objectContaining({ name: "profit", actual: 1000, target: 900, variance: 100 }),
      expect.objectContaining({ name: "profitMargin" }),
      expect.objectContaining({ name: "debtRatio", actual: 0.4, target: 0.5, variance: -0.09999999999999998 }),
    ]);
    expect(result.recommendations).toHaveLength(4);
    expect(result.performance).toHaveLength(4);
  });

  it("fails closed for invalid tenant, metrics or targets", () => {
    expect(() => workbench().execute({
      tenantId: "",
      metrics: { revenue: 1, profit: 1, profitMargin: 1, debtRatio: 1 },
      targets: { revenue: 1, profit: 1, profitMargin: 1, debtRatio: 1 },
    })).toThrow("executive-intelligence-workbench-tenant-required");

    expect(() => workbench().execute({
      tenantId: "tenant:qa",
      metrics: { revenue: Number.NaN, profit: 1, profitMargin: 1, debtRatio: 1 },
      targets: { revenue: 1, profit: 1, profitMargin: 1, debtRatio: 1 },
    })).toThrow("executive-intelligence-workbench-metric-invalid:revenue");

    expect(() => workbench().execute({
      tenantId: "tenant:qa",
      metrics: { revenue: 1, profit: 1, profitMargin: 1, debtRatio: 1 },
      targets: { revenue: 1, profit: Infinity, profitMargin: 1, debtRatio: 1 },
    })).toThrow("executive-intelligence-workbench-target-invalid:profit");
  });
});
