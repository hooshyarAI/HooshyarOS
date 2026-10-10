import { ExecutiveIntelligenceEngine } from "../Engines/ExecutiveIntelligenceEngine";

describe("ExecutiveIntelligenceEngine", () => {
    it("implements the canonical HBOS engine contract", () => {
        const engine = new ExecutiveIntelligenceEngine();
        engine.initialize();
        expect(engine.name).toBe("ExecutiveIntelligenceEngine");
        expect(engine.health()).toBe(true);
    });

    it("analyzes KPI achievement and variance", () => {
        const kpi = new ExecutiveIntelligenceEngine().analyzeKpi("revenue", 80, 100);
        expect(kpi.variance).toBe(-20);
        expect(kpi.achievementRate).toBe(80);
        expect(kpi.direction).toBe("higher-is-better");
    });

    it("produces an evidence-based executive status", () => {
        const engine = new ExecutiveIntelligenceEngine();
        const onTrack = engine.recommend(engine.analyzeKpi("revenue", 110, 100));
        const atRisk = engine.recommend(engine.analyzeKpi("revenue", 90, 100));
        expect(onTrack.status).toBe("ON_TRACK");
        expect(onTrack.actionCode).toBe("MONITOR");
        expect(atRisk.status).toBe("AT_RISK");
        expect(atRisk.actionCode).toBe("INVESTIGATE_TARGET_SHORTFALL");
    });

    it("evaluates performance without hiding invalid targets", () => {
        const engine = new ExecutiveIntelligenceEngine();
        expect(engine.evaluatePerformance(120, 100).status).toBe("ON_TRACK");
        expect(engine.evaluatePerformance(80, 100).status).toBe("BELOW_TARGET");
        expect(engine.evaluatePerformance(80, 0).status).toBe("BLOCKED");
    });

    it("treats lower debt ratios as favorable instead of reversing the recommendation", () => {
        const engine = new ExecutiveIntelligenceEngine();
        const belowTarget = engine.analyzeKpi("debtRatio", 0.35, 0.4, "lower-is-better");
        const aboveTarget = engine.analyzeKpi("debtRatio", 0.45, 0.4, "lower-is-better");

        expect(belowTarget.achievementRate).toBeCloseTo(114.2857, 3);
        expect(engine.recommend(belowTarget).status).toBe("ON_TRACK");
        expect(engine.evaluatePerformance(0.35, 0.4, "lower-is-better").status).toBe("ON_TRACK");
        expect(engine.recommend(aboveTarget).status).toBe("AT_RISK");
        expect(engine.recommend(aboveTarget).actionCode).toBe("INVESTIGATE_TARGET_EXCEEDANCE");
        expect(engine.evaluatePerformance(0.45, 0.4, "lower-is-better").status).toBe("BELOW_TARGET");
    });

    it("blocks a lower-is-better KPI with a non-positive target", () => {
        const engine = new ExecutiveIntelligenceEngine();
        const kpi = engine.analyzeKpi("debtRatio", 0.35, 0, "lower-is-better");
        expect(engine.recommend(kpi).status).toBe("BLOCKED");
        expect(engine.recommend(kpi).actionCode).toBe("VERIFY_INPUTS");
        expect(engine.evaluatePerformance(0.35, 0, "lower-is-better").status).toBe("BLOCKED");
    });
});
