import { ExecutiveIntelligenceEngine } from "./ExecutiveIntelligenceEngine";

describe("ExecutiveIntelligenceEngine Behavior Tests", () => {
    let engine: ExecutiveIntelligenceEngine;

    beforeEach(() => {
        engine = new ExecutiveIntelligenceEngine();
    });

    describe("analyzeKpi", () => {
        it("calculates KPI with valid values", () => {
            const kpi = engine.analyzeKpi("Revenue", 150000, 100000);
            expect(kpi.name).toBe("Revenue");
            expect(kpi.actual).toBe(150000);
            expect(kpi.target).toBe(100000);
            expect(kpi.variance).toBe(50000);
            expect(kpi.achievementRate).toBe(150);
        });

        it("handles zero target correctly", () => {
            const kpi = engine.analyzeKpi("Growth", 50, 0);
            expect(kpi.achievementRate).toBe(0);
            expect(kpi.variance).toBe(50);
        });

        it("returns correct variance for lower actual", () => {
            const kpi = engine.analyzeKpi("Sales", 80000, 100000);
            expect(kpi.variance).toBe(-20000);
        });
    });

    describe("recommend", () => {
        it("returns ON_TRACK for achievement rate >= 100", () => {
            const kpi = { name: "Test", actual: 200, target: 100, variance: 100, achievementRate: 200 };
            const recommendation = engine.recommend(kpi);
            expect(recommendation.status).toBe("ON_TRACK");
            expect(recommendation.action).toContain("Maintain");
        });

        it("returns AT_RISK for achievement rate < 100", () => {
            const kpi = { name: "Test", actual: 80, target: 100, variance: -20, achievementRate: 80 };
            const recommendation = engine.recommend(kpi);
            expect(recommendation.status).toBe("AT_RISK");
            expect(recommendation.action).toContain("Review");
        });

        it("returns BLOCKED for invalid numeric values", () => {
            const kpi = { name: "Test", actual: NaN, target: 100, variance: NaN, achievementRate: NaN };
            const recommendation = engine.recommend(kpi);
            expect(recommendation.status).toBe("BLOCKED");
            expect(recommendation.action).toContain("valid KPI");
        });
    });

    describe("evaluatePerformance", () => {
        it("returns ON_TRACK for achievement rate >= 100", () => {
            const result = engine.evaluatePerformance(150, 100);
            expect(result.status).toBe("ON_TRACK");
            expect(result.achievementRate).toBe(150);
        });

        it("returns BELOW_TARGET for achievement rate < 100", () => {
            const result = engine.evaluatePerformance(75, 100);
            expect(result.status).toBe("BELOW_TARGET");
            expect(result.achievementRate).toBe(75);
        });

        it("returns BLOCKED for invalid values", () => {
            const result1 = engine.evaluatePerformance(NaN, 100);
            expect(result1.status).toBe("BLOCKED");
            expect(result1.achievementRate).toBe(0);

            const result2 = engine.evaluatePerformance(100, 0);
            expect(result2.status).toBe("BLOCKED");
            expect(result2.achievementRate).toBe(0);
        });
    });
});