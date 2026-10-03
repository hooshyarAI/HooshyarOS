import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";

describe("FinancialIntelligenceEngine ROIC & EVA (09-1.3)", () => {
    const engine = new FinancialIntelligenceEngine();

    test("roic computes NOPAT and ROIC", () => {
        const r = engine.roic({ ebit: 200, taxRate: 0.25, equity: 800, debt: 400, cash: 200 });
        expect(r.status).toBe("READY");
        // NOPAT = 200 * 0.75 = 150
        expect(r.nopat).toBeCloseTo(150, 5);
        // IC = 800 + 400 - 200 = 1000
        expect(r.investedCapital).toBe(1000);
        // ROIC = 0.15
        expect(r.roic).toBeCloseTo(0.15, 5);
    });

    test("roic blocks invalid tax rate", () => {
        expect(engine.roic({ ebit: 100, taxRate: 1.5, equity: 100, debt: 50, cash: 10 }).status).toBe("BLOCKED");
        expect(engine.roic({ ebit: 100, taxRate: -0.1, equity: 100, debt: 50, cash: 10 }).status).toBe("BLOCKED");
    });

    test("roic blocks non-positive invested capital", () => {
        // IC = 100 + 50 - 200 = -50 -> BLOCKED
        expect(engine.roic({ ebit: 100, taxRate: 0.25, equity: 100, debt: 50, cash: 200 }).status).toBe("BLOCKED");
    });

    test("eva computes capital charge and EVA", () => {
        const r = engine.eva({ ebit: 200, taxRate: 0.25, equity: 800, debt: 400, cash: 200, wacc: 0.10 });
        expect(r.status).toBe("READY");
        expect(r.nopat).toBeCloseTo(150, 5);
        expect(r.investedCapital).toBe(1000);
        // Capital charge = 0.10 * 1000 = 100
        expect(r.capitalCharge).toBeCloseTo(100, 5);
        // EVA = 150 - 100 = 50
        expect(r.eva).toBeCloseTo(50, 5);
    });

    test("eva negative when NOPAT < WACC*IC", () => {
        const r = engine.eva({ ebit: 50, taxRate: 0.25, equity: 800, debt: 400, cash: 200, wacc: 0.10 });
        expect(r.status).toBe("READY");
        // NOPAT = 37.5, capital charge = 100, EVA = -62.5
        expect(r.eva).toBeCloseTo(-62.5, 5);
    });

    test("eva blocks invalid input", () => {
        expect(engine.eva({ ebit: Number.NaN, taxRate: 0.25, equity: 800, debt: 400, cash: 200, wacc: 0.1 }).status).toBe("BLOCKED");
        expect(engine.eva({ ebit: 100, taxRate: 0.25, equity: 800, debt: 400, cash: 200, wacc: -0.1 }).status).toBe("BLOCKED");
    });

    test("no NaN/Infinity leaks", () => {
        const r = engine.eva({ ebit: 0, taxRate: 0, equity: 100, debt: 0, cash: 0, wacc: 0.10 });
        expect(r.status).toBe("READY");
        expect(Number.isFinite(r.eva)).toBe(true);
        expect(r.eva).toBeCloseTo(-10, 5);
    });
});
