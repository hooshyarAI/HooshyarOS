import { BudgetIntelligenceEngine } from "../Engines/BudgetIntelligenceEngine";

describe("BudgetIntelligenceEngine", () => {
    it("exposes the canonical capability identity and health", () => {
        const engine = new BudgetIntelligenceEngine();
        expect(engine.name).toBe("BudgetIntelligenceEngine");
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability().id).toBe("platform.budget-intelligence");
    });

    it("analyzes budget variance", () => {
        const result = new BudgetIntelligenceEngine().analyze({ planned: 1000, actual: 800 });
        expect(result.status).toBe("READY");
        expect(result.variance).toBe(-200);
        expect(result.utilization).toBeCloseTo(0.8);
    });

    it("keeps the canonical evidence alias on the same analysis contract", () => {
        expect(new BudgetIntelligenceEngine().analyzeBudget({ planned: 1000, actual: 800 })).toEqual(
            new BudgetIntelligenceEngine().analyze({ planned: 1000, actual: 800 })
        );
    });
});
