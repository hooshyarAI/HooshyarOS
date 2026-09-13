import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";

describe("FinancialIntelligenceEngine WACC (09-1.4)", () => {
    const engine = new FinancialIntelligenceEngine();

    test("wacc computes known answer: E=600, D=400, Re=10%, Rd=5%, t=25%", () => {
        const r = engine.wacc({ equity: 600, debt: 400, costOfEquity: 0.10, costOfDebt: 0.05, taxRate: 0.25 });
        expect(r.status).toBe("READY");
        expect(r.equityWeight).toBeCloseTo(0.6, 5);
        expect(r.debtWeight).toBeCloseTo(0.4, 5);
        // afterTax cost of debt = 0.05 * 0.75 = 0.0375
        expect(r.afterTaxCostOfDebt).toBeCloseTo(0.0375, 5);
        // WACC = 0.6 * 0.10 + 0.4 * 0.0375 = 0.075
        expect(r.wacc).toBeCloseTo(0.075, 5);
    });

    test("wacc with all-equity financing equals cost of equity", () => {
        const r = engine.wacc({ equity: 1000, debt: 0, costOfEquity: 0.12, costOfDebt: 0.06, taxRate: 0.25 });
        expect(r.status).toBe("READY");
        expect(r.wacc).toBeCloseTo(0.12, 5);
        expect(r.debtWeight).toBe(0);
    });

    test("wacc with all-debt financing equals after-tax cost of debt", () => {
        const r = engine.wacc({ equity: 0, debt: 1000, costOfEquity: 0.12, costOfDebt: 0.06, taxRate: 0.25 });
        expect(r.status).toBe("READY");
        expect(r.wacc).toBeCloseTo(0.06 * 0.75, 5);
        expect(r.equityWeight).toBe(0);
    });

    test("wacc blocks invalid tax rate", () => {
        expect(engine.wacc({ equity: 100, debt: 50, costOfEquity: 0.10, costOfDebt: 0.05, taxRate: 1.5 }).status).toBe("BLOCKED");
        expect(engine.wacc({ equity: 100, debt: 50, costOfEquity: 0.10, costOfDebt: 0.05, taxRate: -0.1 }).status).toBe("BLOCKED");
    });

    test("wacc blocks negative equity/debt", () => {
        expect(engine.wacc({ equity: -100, debt: 50, costOfEquity: 0.10, costOfDebt: 0.05, taxRate: 0.25 }).status).toBe("BLOCKED");
        expect(engine.wacc({ equity: 100, debt: -50, costOfEquity: 0.10, costOfDebt: 0.05, taxRate: 0.25 }).status).toBe("BLOCKED");
    });

    test("wacc blocks zero total capital", () => {
        expect(engine.wacc({ equity: 0, debt: 0, costOfEquity: 0.10, costOfDebt: 0.05, taxRate: 0.25 }).status).toBe("BLOCKED");
    });

    test("wacc blocks negative cost of capital", () => {
        expect(engine.wacc({ equity: 100, debt: 50, costOfEquity: -0.1, costOfDebt: 0.05, taxRate: 0.25 }).status).toBe("BLOCKED");
        expect(engine.wacc({ equity: 100, debt: 50, costOfEquity: 0.10, costOfDebt: -0.05, taxRate: 0.25 }).status).toBe("BLOCKED");
    });

    test("no NaN/Infinity leaks", () => {
        const r = engine.wacc({ equity: 1e6, debt: 5e5, costOfEquity: 0.08, costOfDebt: 0.04, taxRate: 0.21 });
        expect(r.status).toBe("READY");
        expect(Number.isFinite(r.wacc)).toBe(true);
    });
});
