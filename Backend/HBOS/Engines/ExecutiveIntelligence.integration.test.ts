import { DashboardEngine } from "./DashboardEngine";
import { ExecutiveIntelligenceEngine } from "./ExecutiveIntelligenceEngine";

describe("Executive intelligence integration", () => {
  it("connects KPI analysis and executive recommendation to a dashboard snapshot", () => {
    const executive = new ExecutiveIntelligenceEngine();
    const dashboard = new DashboardEngine();
    const kpi = executive.analyzeKpi("Revenue", 900, 1000);
    const recommendation = executive.recommend(kpi);
    const snapshot = dashboard.snapshot({ revenueAchievement: kpi.achievementRate, variance: kpi.variance });

    expect(kpi.achievementRate).toBe(90);
    expect(recommendation.status).toBe("AT_RISK");
    expect(snapshot.status).toBe("READY");
    expect(snapshot.metrics.revenueAchievement).toBe(90);
    expect(snapshot.metrics.variance).toBe(-100);
  });
});
