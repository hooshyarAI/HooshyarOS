import { TaxIntelligenceEngine } from "../Engines/TaxIntelligenceEngine";

describe("TaxIntelligenceEngine", () => {
    it("exposes canonical identity and health", () => {
        const engine = new TaxIntelligenceEngine();
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability().id).toBe("platform.tax-intelligence");
    });

    it("estimates tax deterministically from taxable amount and rate", () => {
        const result = new TaxIntelligenceEngine().estimate(1000, 0.1);
        expect(result.status).toBe("READY");
        expect(result.estimate).toBe(100);
    });
});
