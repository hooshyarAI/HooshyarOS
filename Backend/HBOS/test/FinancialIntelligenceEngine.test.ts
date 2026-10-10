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

    test("blocks invalid financial input with an explicit reason", () => {
        expect(new FinancialIntelligenceEngine().analyze({
            revenue: Number.NaN,
            expenses: 700,
            assets: 2000,
            liabilities: 500
        })).toMatchObject({ status: "BLOCKED", reason: "INVALID_FINANCIAL_INPUT" });
    });

    test("blocks debt-ratio analysis when assets denominator is zero instead of reporting zero risk", () => {
        const engine = new FinancialIntelligenceEngine();

        expect(engine.analyze({
            revenue: 100,
            expenses: 80,
            assets: 0,
            liabilities: 20
        })).toMatchObject({ status: "BLOCKED", reason: "DEBT_RATIO_DENOMINATOR_ZERO" });

        expect(engine.analyze({
            revenue: 100,
            expenses: 80,
            assets: 0,
            liabilities: 0
        })).toMatchObject({ status: "BLOCKED", reason: "DEBT_RATIO_DENOMINATOR_ZERO" });
    });
});
