import { RiskIntelligenceEngine } from "../Engines/RiskIntelligenceEngine";

describe("RiskIntelligenceEngine", () => {
    it("initializes healthy", () => {
        const engine = new RiskIntelligenceEngine();
        expect(engine.initialize().status).toBe("READY");
        expect(engine.health()).toBe(true);
    });

    it("assesses probability and impact", () => {
        const result = new RiskIntelligenceEngine().assess(0.2, 10);
        expect(result.status).toBe("READY");
        expect(result.score).toBe(2);
    });
});
