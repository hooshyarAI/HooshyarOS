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
    });

    it("produces an evidence-based executive status", () => {
        const engine = new ExecutiveIntelligenceEngine();
        const onTrack = engine.recommend(engine.analyzeKpi("revenue", 110, 100));
        const atRisk = engine.recommend(engine.analyzeKpi("revenue", 90, 100));
        expect(onTrack.status).toBe("ON_TRACK");
        expect(atRisk.status).toBe("AT_RISK");
    });

    it("evaluates performance without hiding invalid targets", () => {
        const engine = new ExecutiveIntelligenceEngine();
        expect(engine.evaluatePerformance(120, 100).status).toBe("ON_TRACK");
        expect(engine.evaluatePerformance(80, 100).status).toBe("BELOW_TARGET");
        expect(engine.evaluatePerformance(80, 0).status).toBe("BLOCKED");
    });
});
