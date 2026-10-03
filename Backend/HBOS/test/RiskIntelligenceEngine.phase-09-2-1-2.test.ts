import { RiskIntelligenceEngine } from "../Engines/RiskIntelligenceEngine";

describe("RiskIntelligenceEngine Monte Carlo + VaR/CVaR (09-2.1 / 09-2.2)", () => {
    const engine = new RiskIntelligenceEngine();

    test("Monte Carlo: deterministic seeded uniform", () => {
        const r = engine.monteCarlo({
            base: { a: 0, b: 0 },
            variables: [
                { name: "a", distribution: "uniform", min: 0, max: 10 },
                { name: "b", distribution: "uniform", min: 0, max: 10 }
            ],
            model: (p) => (p as any).a + (p as any).b,
            iterations: 1000,
            seed: 42
        });
        expect(r.status).toBe("READY");
        expect(r.iterations).toBe(1000);
        // mean of a+b with uniform(0,10) each -> ~10
        expect(r.mean).toBeCloseTo(10, 0);
        // max should be close to 20
        expect(r.max).toBeLessThanOrEqual(20);
        expect(r.min).toBeGreaterThanOrEqual(0);
    });

    test("Monte Carlo: deterministic seeded normal", () => {
        const r = engine.monteCarlo({
            base: { x: 0 },
            variables: [
                { name: "x", distribution: "normal", mean: 100, stdDev: 5 }
            ],
            model: (p) => (p as any).x,
            iterations: 5000,
            seed: 7
        });
        expect(r.status).toBe("READY");
        // mean ~ 100, stdDev ~ 5
        expect(r.mean).toBeCloseTo(100, 0);
        expect(r.stdDev).toBeCloseTo(5, 0);
    });

    test("Monte Carlo: same seed -> same mean (deterministic)", () => {
        const a = engine.monteCarlo({ base: {}, variables: [{ name: "x", distribution: "uniform", min: 0, max: 1 }], model: (p) => (p as any).x, iterations: 500, seed: 123 });
        const b = engine.monteCarlo({ base: {}, variables: [{ name: "x", distribution: "uniform", min: 0, max: 1 }], model: (p) => (p as any).x, iterations: 500, seed: 123 });
        expect(a.mean).toBe(b.mean);
    });

    test("Monte Carlo: blocks invalid iterations", () => {
        const r = engine.monteCarlo({ base: {}, variables: [], model: () => 0, iterations: 0, seed: 1 });
        expect(r.status).toBe("BLOCKED");
    });

    test("Monte Carlo: blocks invalid uniform bounds", () => {
        const r = engine.monteCarlo({
            base: { a: 0 },
            variables: [{ name: "a", distribution: "uniform", min: 5, max: 1 }],
            model: (p) => (p as any).a,
            iterations: 100,
            seed: 1
        });
        expect(r.status).toBe("BLOCKED");
    });

    test("Monte Carlo: blocks non-finite model output", () => {
        const r = engine.monteCarlo({
            base: { x: 0 },
            variables: [{ name: "x", distribution: "uniform", min: 0, max: 1 }],
            model: () => Number.NaN,
            iterations: 100,
            seed: 1
        });
        expect(r.status).toBe("BLOCKED");
    });

    test("VaR: known negative returns at 95%", () => {
        // 5 losses of -10, 5 gains of +5; alpha=0.95 -> 5% worst
        const r = engine.valueAtRisk({ returns: [-10, -10, -10, -10, -10, 5, 5, 5, 5, 5], alpha: 0.95 });
        expect(r.status).toBe("READY");
        // Worst return is -10 -> VaR = 10
        expect(r.var).toBe(10);
    });

    test("VaR: blocks invalid alpha", () => {
        expect(engine.valueAtRisk({ returns: [1, 2, 3], alpha: 0 }).status).toBe("BLOCKED");
        expect(engine.valueAtRisk({ returns: [1, 2, 3], alpha: 1.5 }).status).toBe("BLOCKED");
    });

    test("VaR: blocks NaN", () => {
        expect(engine.valueAtRisk({ returns: [1, 2, Number.NaN], alpha: 0.95 }).status).toBe("BLOCKED");
    });

    test("CVaR is greater than or equal to VaR", () => {
        const r = engine.valueAtRisk({ returns: [-20, -10, -5, 0, 5, 10, 15, 20], alpha: 0.95 });
        expect(r.status).toBe("READY");
        expect(r.cvar).toBeGreaterThanOrEqual(r.var);
    });
});
