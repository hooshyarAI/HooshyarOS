import { TaxIntelligenceEngine } from "../Engines/TaxIntelligenceEngine";

describe("TaxIntelligenceEngine", () => {
    it("exposes the canonical capability identity and health", () => {
        const engine = new TaxIntelligenceEngine();
        expect(engine.name).toBe("TaxIntelligenceEngine");
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability()).toEqual({
            id: "platform.tax-intelligence",
            capability: "implement Tax Intelligence",
            targetEngine: "Tax Intelligence Engine"
        });
    });
});
