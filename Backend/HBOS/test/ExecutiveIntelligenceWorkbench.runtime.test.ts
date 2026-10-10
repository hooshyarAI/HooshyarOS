import { ExecutiveIntelligenceEngine } from "../Engines/ExecutiveIntelligenceEngine";
import { ExecutiveIntelligenceWorkbench } from "../Product/ExecutiveIntelligenceWorkbench";

describe("ExecutiveIntelligenceWorkbench runtime contract", () => {
  it("initializes and produces a complete executive evaluation from verified metrics and explicit targets", () => {
    const engine = new ExecutiveIntelligenceEngine();
    const workbench = new ExecutiveIntelligenceWorkbench(engine);

    expect(engine.health()).toBe(true);
    expect(workbench.initialize()).toEqual({ status: "READY" });

    const result = workbench.execute({
      tenantId: "tenant:runtime-test",
      metrics: { revenue: 1200, profit: 240, profitMargin: 0.2, debtRatio: 0.35 },
      targets: { revenue: 1000, profit: 200, profitMargin: 0.18, debtRatio: 0.4 },
    });

    expect(result.status).toBe("READY");
    expect(result.tenantId).toBe("tenant:runtime-test");
    expect(result.kpis).toHaveLength(4);
    expect(result.recommendations).toHaveLength(4);
    expect(result.performance).toHaveLength(4);
    expect(result.kpis.every((kpi) => Number.isFinite(kpi.variance))).toBe(true);
  });
});
