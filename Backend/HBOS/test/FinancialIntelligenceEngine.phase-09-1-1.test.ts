import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";

describe("FinancialIntelligenceEngine NPV / IRR / Payback (09-1.1)", () => {
    const engine = new FinancialIntelligenceEngine();

    test("npv computes known answer: -1000 + 1100/(1.10) = 0", () => {
        const r = engine.npv({ initial: -1000, flows: [1100], discountRate: 0.10 });
        expect(r.status).toBe("READY");
        expect(r.npv).toBeCloseTo(0, 5);
        expect(r.periods).toBe(1);
    });

    test("npv computes known answer: 5-year annuity", () => {
        // 100 per year for 5 years at 10%, PV = 100 * (1 - 1.1^-5)/0.1 = 379.0787
        const r = engine.npv({ initial: 0, flows: [100, 100, 100, 100, 100], discountRate: 0.10 });
        expect(r.status).toBe("READY");
        expect(r.npv).toBeCloseTo(379.0787, 3);
    });

    test("npv blocks invalid input", () => {
        expect(engine.npv({ initial: Number.NaN, flows: [100], discountRate: 0.1 }).status).toBe("BLOCKED");
        expect(engine.npv({ initial: -100, flows: [], discountRate: 0.1 }).status).toBe("BLOCKED");
        expect(engine.npv({ initial: -100, flows: [Number.POSITIVE_INFINITY], discountRate: 0.1 }).status).toBe("BLOCKED");
        expect(engine.npv({ initial: -100, flows: [100], discountRate: -2 }).status).toBe("BLOCKED");
    });

    test("irr computes known answer: -1000, +1100 -> 10%", () => {
        const r = engine.irr({ initial: -1000, flows: [1100] });
        expect(r.status).toBe("READY");
        expect(r.converged).toBe(true);
        expect(r.irr).toBeCloseTo(0.10, 4);
    });

    test("irr computes known answer: -100, +50, +75 -> ~15.1%", () => {
        const r = engine.irr({ initial: -100, flows: [50, 75] });
        expect(r.status).toBe("READY");
        expect(r.irr).toBeCloseTo(0.1514, 3);
    });

    test("irr returns BLOCKED when no real root exists", () => {
        // All flows negative -> NPV is always negative for r >= 0
        const r = engine.irr({ initial: -100, flows: [-50, -50, -50] });
        expect(r.status).toBe("BLOCKED");
        expect(r.converged).toBe(false);
    });

    test("irr blocks invalid input", () => {
        expect(engine.irr({ initial: Number.NaN, flows: [100] }).status).toBe("BLOCKED");
        expect(engine.irr({ initial: -100, flows: [] }).status).toBe("BLOCKED");
        expect(engine.irr({ initial: -100, flows: [Number.POSITIVE_INFINITY] }).status).toBe("BLOCKED");
    });

    test("payback plain period: -100, +30, +30, +30, +30 -> 3.333", () => {
        const r = engine.payback({ initial: -100, flows: [30, 30, 30, 30], discountRate: 0 });
        expect(r.status).toBe("READY");
        expect(r.paybackPeriod).toBeCloseTo(100 / 30, 5);
        expect(r.fullyRecovered).toBe(true);
    });

    test("payback never recovered within horizon -> NaN period", () => {
        const r = engine.payback({ initial: -100, flows: [10, 10, 10], discountRate: 0 });
        expect(r.status).toBe("READY");
        expect(r.fullyRecovered).toBe(false);
        expect(Number.isNaN(r.paybackPeriod)).toBe(true);
    });

    test("payback discounted period > plain period", () => {
        const r = engine.payback({ initial: -100, flows: [60, 60], discountRate: 0.10 });
        expect(r.status).toBe("READY");
        expect(r.discountedPaybackPeriod).toBeGreaterThan(r.paybackPeriod);
    });

    test("payback blocks invalid input", () => {
        expect(engine.payback({ initial: -100, flows: [], discountRate: 0.1 }).status).toBe("BLOCKED");
        expect(engine.payback({ initial: Number.NaN, flows: [100], discountRate: 0.1 }).status).toBe("BLOCKED");
        expect(engine.payback({ initial: -100, flows: [Number.NaN], discountRate: 0.1 }).status).toBe("BLOCKED");
    });

    test("does not leak NaN/Infinity for edge cases", () => {
        const r = engine.npv({ initial: -1e-9, flows: [1e-9], discountRate: 0 });
        expect(Number.isFinite(r.npv)).toBe(true);
        const p = engine.payback({ initial: -1, flows: [0, 1], discountRate: 0 });
        expect(Number.isFinite(p.paybackPeriod)).toBe(true);
    });
});
