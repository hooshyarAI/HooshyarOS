import { BudgetIntelligenceEngine } from "../Engines/BudgetIntelligenceEngine";

describe("BudgetIntelligenceEngine", () => {
    it("exposes the canonical capability identity and health", () => {
        const engine = new BudgetIntelligenceEngine();
        expect(engine.name).toBe("BudgetIntelligenceEngine");
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability()).toEqual({
            id: "platform.budget-intelligence",
            capability: "implement Budget Intelligence",
            targetEngine: "Budget Intelligence Engine"
        });
    });
});
