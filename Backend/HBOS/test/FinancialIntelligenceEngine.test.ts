import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";

describe("FinancialIntelligenceEngine", () => {
    test("engine initializes healthy", () => {
        const engine = new FinancialIntelligenceEngine();
        expect(engine.initialize().status).toBe("READY");
        expect(engine.health()).toBe(true);
    });

    test("performs deterministic financial analysis", () => {
        const result = new FinancialIntelligenceEngine().analyze({
            revenue: 1000,
            expenses: 700,
            assets: 2000,
            liabilities: 500
        });

        expect(result.status).toBe("READY");
        expect(result.profit).toBe(300);
        expect(result.profitMargin).toBeCloseTo(0.3);
        expect(result.debtRatio).toBeCloseTo(0.25);
    });

    test("blocks invalid financial input", () => {
        expect(new FinancialIntelligenceEngine().analyze({
            revenue: Number.NaN,
            expenses: 700,
            assets: 2000,
            liabilities: 500
        }).status).toBe("BLOCKED");
    });
});
