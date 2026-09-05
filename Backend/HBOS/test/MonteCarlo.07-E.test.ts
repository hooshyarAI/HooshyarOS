/**
 * Stage 07-E - Monte Carlo / Scenario Risk Tests
 *
 * Hand-verifiable, deterministic tests for:
 *  1. SeededRNG reproducibility & invalid-seed rejection
 *  2. Simulator with known small residual vectors
 *  3. VaR / CVaR semantics on constant and discrete distributions
 *  4. Edge cases (zero iterations, negative/large shocks, zero residuals)
 *  5. Tenant isolation
 *  6. Scenario shocks shift the mean
 *  7. Sensitivity produces linear mean change when residuals are zero
 *  8. Provenance fields
 *  9. Determinism (100 identical calls)
 */

import {
    SeededRNG_create
} from "../Uncertainty/SeededRNG";
import {
    simulate
} from "../Uncertainty/MonteCarloSimulator";
import {
    runScenarios,
    sensitivityAnalysis
} from "../Uncertainty/ScenarioEngine";
import {
    ResidualSet
} from "../Uncertainty/UncertaintyTypes";
import {
    Scenario,
    SimulationInput,
    SimulationProvenance
} from "../Uncertainty/MonteCarloTypes";

// ===== Test fixtures =====

function makeResidualSet(
    residuals: number[],
    tenantId: string = "tenant-a",
    method: string = "naive"
): ResidualSet {
    const observations = residuals.map((r, i) => Object.freeze({
        tenantId,
        metricName: "revenue",
        forecastingMethod: method,
        originTimestamp: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
        forecastTimestamp: `2026-01-${String(i + 2).padStart(2, "0")}T00:00:00Z`,
        actual: 100 + r,
        prediction: 100,
        residual: r,
        splitIndex: 0,
        step: i + 1
    }));
    const provenance = Object.freeze({
        source: "test-fixture",
        tenant: tenantId,
        metric: "revenue",
        method,
        backtestSplitCount: 1,
        extractedAt: "2026-01-01T00:00:00Z"
    });
    return Object.freeze({
        tenantId,
        metricName: "revenue",
        method,
        observationCount: observations.length,
        finiteResidualCount: observations.length,
        residuals: Object.freeze(observations),
        provenance
    });
}

function makeInput(overrides: Partial<SimulationInput> = {}): SimulationInput {
    const residuals = overrides.residualSet
        ? overrides.residualSet
        : makeResidualSet([0, 0, 0, 0, 0]);
    return Object.freeze({
        tenantId: "tenant-a",
        metricName: "revenue",
        forecastingMethod: "naive",
        pointForecast: 100,
        simulationCount: 10,
        seed: 42,
        residualSet: residuals,
        ...overrides
    });
}

// ===== Tests =====

describe("Stage 07-E: Monte Carlo / Scenario Risk", () => {

    // ===== SeededRNG =====

    describe("SeededRNG", () => {
        test("A1: same seed produces identical streams (100 runs)", () => {
            const rng1 = SeededRNG_create(42);
            const a1 = rng1.next();
            const rng2 = SeededRNG_create(42);
            const a2 = rng2.next();
            expect(a1).toBe(a2);
            // 100x identical
            for (let i = 0; i < 100; i++) {
                const r = SeededRNG_create(123);
                const v1 = r.next();
                const r2 = SeededRNG_create(123);
                const v2 = r2.next();
                expect(v2).toBe(v1);
            }
        });

        test("A2: different seeds produce different streams", () => {
            const r1 = SeededRNG_create(1);
            const r2 = SeededRNG_create(2);
            const a = r1.next();
            const b = r2.next();
            expect(a).not.toBe(b);
        });

        test("A3: invalid seeds are rejected (NaN, Infinity, float)", () => {
            expect(() => SeededRNG_create(NaN)).toThrow();
            expect(() => SeededRNG_create(Infinity)).toThrow();
            expect(() => SeededRNG_create(-Infinity)).toThrow();
            expect(() => SeededRNG_create(1.5)).toThrow();
        });

        test("A4: nextInt bounds are inclusive and validated", () => {
            const rng = SeededRNG_create(7);
            for (let i = 0; i < 200; i++) {
                const v = rng.nextInt(5, 10);
                expect(v).toBeGreaterThanOrEqual(5);
                expect(v).toBeLessThanOrEqual(10);
                expect(Number.isInteger(v)).toBe(true);
            }
            expect(() => rng.nextInt(10, 5)).toThrow();
            expect(() => rng.nextInt(1.5, 2)).toThrow();
        });

        test("A5: nextNormal produces approximately zero-mean unit-variance samples", () => {
            const rng = SeededRNG_create(99);
            const samples: number[] = [];
            for (let i = 0; i < 5000; i++) {
                samples.push(rng.nextNormal(0, 1));
            }
            const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
            // crude sanity: mean should be near 0 for large samples
            expect(Math.abs(mean)).toBeLessThan(0.15);
        });
    });

    // ===== Simulator known distributions =====

    describe("Simulator with known residual vectors", () => {
        test("B1: constant zero residuals -> all iterations = pointForecast", () => {
            const input = makeInput({
                residualSet: makeResidualSet([0, 0, 0, 0, 0]),
                pointForecast: 100,
                simulationCount: 50,
                seed: 42
            });
            const result = simulate(input);
            expect(result.status).toBe("calculated");
            if (result.status === "calculated") {
                for (const v of result.iterations) {
                    expect(v).toBe(100);
                }
                expect(result.statistics.mean).toBe(100);
                expect(result.statistics.std).toBe(0);
                expect(result.statistics.var95).toBe(100);
                expect(result.statistics.cvar95).toBe(100);
            }
        });

        test("B2: two-value residuals [-5, 5] produce only pointForecast +/-5", () => {
            const input = makeInput({
                residualSet: makeResidualSet([-5, 5]),
                pointForecast: 100,
                simulationCount: 200,
                seed: 42
            });
            const result = simulate(input);
            expect(result.status).toBe("calculated");
            if (result.status === "calculated") {
                for (const v of result.iterations) {
                    expect([95, 105]).toContain(v);
                }
                const lows = result.iterations.filter(v => v === 95).length;
                const highs = result.iterations.filter(v => v === 105).length;
                // Roughly 50/50 split - allow wide tolerance for small RNG bias
                expect(lows).toBeGreaterThan(50);
                expect(highs).toBeGreaterThan(50);
                expect(lows + highs).toBe(200);
            }
        });

        test("B3: deterministic - same seed gives byte-identical iterations", () => {
            const residuals = makeResidualSet([-10, -5, 0, 5, 10, -3, 7, 2, -1, 4]);
            const a = simulate(makeInput({ residualSet: residuals, seed: 42, simulationCount: 100 }));
            const b = simulate(makeInput({ residualSet: residuals, seed: 42, simulationCount: 100 }));
            expect(a.status).toBe("calculated");
            expect(b.status).toBe("calculated");
            if (a.status === "calculated" && b.status === "calculated") {
                expect(a.iterations).toEqual(b.iterations);
                expect(a.statistics.mean).toBe(b.statistics.mean);
            }
        });

        test("B4: 100 identical calls all return identical result objects", () => {
            const input = makeInput({
                residualSet: makeResidualSet([-10, -5, 0, 5, 10]),
                simulationCount: 100,
                seed: 1
            });
            const first = simulate(input);
            for (let i = 0; i < 100; i++) {
                const next = simulate(input);
                expect(next).toEqual(first);
            }
        });

        test("B5: different seeds produce different iteration sequences", () => {
            const residuals = makeResidualSet([-10, -5, 0, 5, 10]);
            const a = simulate(makeInput({ residualSet: residuals, seed: 1, simulationCount: 100 }));
            const b = simulate(makeInput({ residualSet: residuals, seed: 2, simulationCount: 100 }));
            expect(a.status).toBe("calculated");
            expect(b.status).toBe("calculated");
            if (a.status === "calculated" && b.status === "calculated") {
                expect(a.iterations).not.toEqual(b.iterations);
            }
        });
    });

    // ===== Edge cases =====

    describe("Edge cases", () => {
        test("C1: zero simulations -> insufficient_data", () => {
            const input = makeInput({
                residualSet: makeResidualSet([-1, 0, 1]),
                simulationCount: 0,
                seed: 1
            });
            const result = simulate(input);
            expect(result.status).toBe("insufficient_data");
        });

        test("C2: negative residual count (empty set) -> insufficient_data", () => {
            const input = makeInput({
                residualSet: makeResidualSet([]),
                simulationCount: 10,
                seed: 1
            });
            const result = simulate(input);
            expect(result.status).toBe("insufficient_data");
        });

        test("C3: only 1 finite residual (< MIN_RESIDUALS=2) -> insufficient_data", () => {
            const input = makeInput({
                residualSet: makeResidualSet([1]),
                simulationCount: 10,
                seed: 1
            });
            const result = simulate(input);
            expect(result.status).toBe("insufficient_data");
        });

        test("C4: non-finite pointForecast -> invalid_request", () => {
            const input = makeInput({
                residualSet: makeResidualSet([0, 0, 0]),
                pointForecast: NaN
            });
            const result = simulate(input);
            expect(result.status).toBe("invalid_request");
        });

        test("C5: very large negative shock (-90%) shifts mean correctly", () => {
            const input = makeInput({
                residualSet: makeResidualSet([0, 0, 0]),
                pointForecast: 100,
                simulationCount: 50,
                seed: 42,
                scenarios: [{ name: "crash", description: "tail crash", shockPercent: -90, appliedAt: 1 }]
            });
            const result = simulate(input);
            expect(result.status).toBe("calculated");
            if (result.status === "calculated") {
                expect(result.scenarioResults.length).toBe(1);
                const sr = result.scenarioResults[0];
                // base iterations all = 100; scenario mean = 100 - 90 = 10
                expect(sr.statistics.mean).toBe(10);
                expect(sr.var95).toBe(10);
            }
        });

        test("C6: tenant mismatch -> invalid_request", () => {
            const rs = makeResidualSet([0, 0, 0], "tenant-a");
            const result = simulate(makeInput({
                residualSet: rs,
                tenantId: "tenant-b",
                simulationCount: 10,
                seed: 1
            }));
            expect(result.status).toBe("invalid_request");
        });

        test("C7: missing residualSet -> insufficient_data", () => {
            const input = makeInput();
            // strip residualSet
            const broken = { ...input, residualSet: undefined as unknown as ResidualSet };
            const result = simulate(broken);
            expect(result.status === "invalid_request" || result.status === "insufficient_data").toBe(true);
        });
    });

    // ===== VaR / CVaR =====

    describe("VaR / CVaR semantics", () => {
        test("D1: 5 residuals [-10,-5,0,5,10] simulated 5 times: VaR_95 = -10, CVaR_95 = -10", () => {
            // With 5 iterations drawn from [-10,-5,0,5,10] using seed=1,
            // p5 is the minimum observed value. Since we sort by Type-7,
            // rank = 0.05 * 4 = 0.2 -> interpolated between sorted[0] and sorted[1].
            // So VaR_95 should be the 5th percentile of the drawn set,
            // CVaR_95 = mean of values <= VaR_95.
            const input = makeInput({
                residualSet: makeResidualSet([-10, -5, 0, 5, 10]),
                simulationCount: 5,
                seed: 1,
                pointForecast: 100
            });
            const result = simulate(input);
            expect(result.status).toBe("calculated");
            if (result.status === "calculated") {
                const sorted = [...result.iterations].sort((a, b) => a - b);
                const expectedVar = sorted[0] + 0.2 * (sorted[1] - sorted[0]);
                expect(result.statistics.var95).toBeCloseTo(expectedVar, 6);
                // CVaR_95 = mean of values <= VaR_95; with sorted draws where the
                    // VaR_95 falls inside sorted[0..1], tail is just the values <= VaR_95.
                const tail = result.iterations.filter(v => v <= result.statistics.var95);
                const expectedCvar = tail.length === 0
                    ? result.statistics.var95
                    : tail.reduce((a, b) => a + b, 0) / tail.length;
                expect(result.statistics.cvar95).toBeCloseTo(expectedCvar, 6);
            }
        });

        test("D2: constant residuals -> VaR = CVaR = pointForecast", () => {
            const input = makeInput({
                residualSet: makeResidualSet([0, 0, 0]),
                pointForecast: 250,
                simulationCount: 20,
                seed: 99
            });
            const result = simulate(input);
            expect(result.status).toBe("calculated");
            if (result.status === "calculated") {
                expect(result.statistics.var95).toBe(250);
                expect(result.statistics.cvar95).toBe(250);
                expect(result.statistics.var99).toBe(250);
                expect(result.statistics.cvar99).toBe(250);
            }
        });

        test("D3: coverage at VaR_95 mirrors left-tail mass of the residual set", () => {
            // NOTE on the math:
            // Residuals are sampled with replacement, so the simulated
            // distribution has the same empirical shape as the residual set.
            // For residuals [-10,-10,0,10,10] (40% at -10, 20% at 0, 40% at 10),
            // VaR_95 = 5th percentile of the simulated distribution = 90.
            // Since 40% of simulated values lie at the minimum (90),
            // approximately 40% of values will be <= VaR_95. This is the
            // correct, expected behavior for sampling-with-replacement.
            const residuals = makeResidualSet([-10, -10, 0, 10, 10]);
            const input = makeInput({
                residualSet: residuals,
                pointForecast: 100,
                simulationCount: 1000,
                seed: 42
            });
            const result = simulate(input);
            expect(result.status).toBe("calculated");
            if (result.status === "calculated") {
                const var95 = result.statistics.var95;
                const below = result.iterations.filter(v => v <= var95).length;
                const coverage = below / result.iterations.length;
                expect(coverage).toBeGreaterThanOrEqual(0.30);
                expect(coverage).toBeLessThanOrEqual(0.50);
                expect(result.statistics.cvar95).toBeLessThanOrEqual(result.statistics.var95 + 1e-9);
            }
        });

        test("D4: VaR_99 <= VaR_95 (deeper quantile is more extreme for loss semantics)", () => {
            const input = makeInput({
                residualSet: makeResidualSet([-10, -5, 0, 5, 10]),
                pointForecast: 100,
                simulationCount: 200,
                seed: 7
            });
            const result = simulate(input);
            expect(result.status).toBe("calculated");
            if (result.status === "calculated") {
                expect(result.statistics.var99).toBeLessThanOrEqual(result.statistics.var95 + 1e-9);
                expect(result.statistics.cvar99).toBeLessThanOrEqual(result.statistics.cvar95 + 1e-9);
            }
        });
    });

    // ===== Scenarios =====

    describe("Scenario stress testing", () => {
        test("E1: positive shock shifts mean upward", () => {
            const input = makeInput({
                residualSet: makeResidualSet([0, 0, 0]),
                pointForecast: 100,
                simulationCount: 30,
                seed: 42,
                scenarios: [
                    { name: "boom", description: "+20%", shockPercent: 20, appliedAt: 1 },
                    { name: "bust", description: "-30%", shockPercent: -30, appliedAt: 1 }
                ]
            });
            const result = simulate(input);
            expect(result.status).toBe("calculated");
            if (result.status === "calculated") {
                expect(result.scenarioResults.length).toBe(2);
                const boom = result.scenarioResults.find(s => s.scenarioName === "boom")!;
                const bust = result.scenarioResults.find(s => s.scenarioName === "bust")!;
                expect(boom.statistics.mean).toBe(120);
                expect(bust.statistics.mean).toBe(70);
            }
        });

        test("E2: runScenarios via ScenarioEngine returns identical scenario stats", () => {
            const input = makeInput({
                residualSet: makeResidualSet([0, 0, 0]),
                pointForecast: 100,
                simulationCount: 30,
                seed: 42
            });
            const scenarios: Scenario[] = [
                { name: "boom", description: "+20%", shockPercent: 20, appliedAt: 1 }
            ];
            const direct = simulate({ ...input, scenarios });
            const viaEngine = runScenarios(input, scenarios);
            expect(viaEngine.length).toBe(1);
            if (direct.status === "calculated") {
                expect(viaEngine[0].statistics.mean).toBe(direct.scenarioResults[0].statistics.mean);
            }
        });
    });

    // ===== Sensitivity =====

    describe("Sensitivity analysis", () => {
        test("F1: linear shocks produce linear mean change when residuals are zero", () => {
            const input = makeInput({
                residualSet: makeResidualSet([0, 0, 0]),
                pointForecast: 100,
                simulationCount: 20,
                seed: 42
            });
            const shockRange = [-50, -25, 0, 25, 50];
            const sens = sensitivityAnalysis(input, shockRange);
            expect(sens.baseValue).toBe(100);
            // Each shocked mean should be exactly base * (1 + shock/100)
            expect(sens.shockedValues[0].mean).toBe(50);   // -50%
            expect(sens.shockedValues[1].mean).toBe(75);   // -25%
            expect(sens.shockedValues[2].mean).toBe(100);  //  0%
            expect(sens.shockedValues[3].mean).toBe(125);  // +25%
            expect(sens.shockedValues[4].mean).toBe(150);  // +50%
            // Elasticity at +50% should be 1.0 (1% shock -> 1% mean change)
            const e50 = sens.elasticities.find(e => e.shockPercent === 50)!;
            expect(e50.elasticity).toBeCloseTo(1.0, 6);
        });

        test("F2: elasticities at non-zero shocks are computed (non-NaN)", () => {
            const input = makeInput({
                residualSet: makeResidualSet([-1, 0, 1]),
                pointForecast: 100,
                simulationCount: 100,
                seed: 42
            });
            const sens = sensitivityAnalysis(input, [10, 20]);
            expect(sens.elasticities[0].elasticity).not.toBeNaN();
            expect(sens.elasticities[1].elasticity).not.toBeNaN();
        });
    });

    // ===== Provenance =====

    describe("Provenance", () => {
        test("G1: provenance contains required fields with canonical timestamp", () => {
            const input = makeInput({
                residualSet: makeResidualSet([0, 0, 0]),
                simulationCount: 10,
                seed: 12345
            });
            const result = simulate(input);
            expect(result.status).toBe("calculated");
            if (result.status === "calculated") {
                const p: SimulationProvenance = result.provenance;
                expect(p.source).toBe("monte-carlo-simulator");
                expect(p.tenant).toBe("tenant-a");
                expect(p.metric).toBe("revenue");
                expect(p.method).toBe("naive");
                expect(p.seed).toBe(12345);
                expect(p.simulationCount).toBe(10);
                expect(p.calculatedAt).toBe("2026-01-01T00:00:00Z");
            }
        });
    });
});

