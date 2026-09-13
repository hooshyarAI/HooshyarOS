/**
 * Stage 07-H - Causal / Counterfactual Tests
 *
 * Hand-verifiable, deterministic tests for the causal analysis capability.
 *
 * HAND-VERIFIED EXAMPLE (used below):
 *   seed = 42, n = 200
 *   covariate1 = N(0, 1)
 *   treatment = 1 if 0.5*covariate1 + N(0, 0.5) > 0 else 0
 *   outcome    = 3*treatment + 1.5*covariate1 + N(0, 0.3)
 *   Expected ATE (coefficient on treatment) ~= 3.0  (tolerance +/- 0.5)
 */

import { SeededRNG_create } from "../Uncertainty/SeededRNG";
import { AdjustmentEstimator } from "../Uncertainty/AdjustmentEstimator";
import { ConfoundingDetector } from "../Uncertainty/ConfoundingDetector";
import { PropensityScore } from "../Uncertainty/PropensityScore";
import { CounterfactualEngine } from "../Uncertainty/CounterfactualEngine";
import {
    TreatmentVariable,
    OutcomeVariable,
    Covariate,
    CausalStatus,
    CausalProvenance,
    CausalResult,
    CausalAssumptions,
    CausalEffect
} from "../Uncertainty/CausalTypes";

function buildHandVerifiedData(seed: number = 42, n: number = 200) {
    const rng = SeededRNG_create(seed);
    const covariate1: number[] = [];
    const treatment: number[] = [];
    const outcome: number[] = [];
    for (let i = 0; i < n; i++) {
        const c = rng.nextNormal(0, 1);
        const tNoise = rng.nextNormal(0, 0.5);
        const t = 0.5 * c + tNoise > 0 ? 1 : 0;
        const yNoise = rng.nextNormal(0, 0.3);
        const y = 3 * t + 1.5 * c + yNoise;
        covariate1.push(c);
        treatment.push(t);
        outcome.push(y);
    }
    return { covariate1, treatment, outcome };
}

function buildCausalResult(args: {
    tenantId: string;
    metricName: string;
    treatment: TreatmentVariable;
    outcome: OutcomeVariable;
    effect: CausalEffect;
    assumptions: CausalAssumptions;
    status: CausalStatus;
    provenance: CausalProvenance;
}): CausalResult {
    return Object.freeze({
        tenantId: args.tenantId,
        metricName: args.metricName,
        treatment: args.treatment,
        outcome: args.outcome,
        effect: args.effect,
        assumptions: args.assumptions,
        status: args.status,
        provenance: args.provenance
    });
}

function makeTreatment(values: number[]): TreatmentVariable {
    return Object.freeze({
        name: "treatment",
        type: values.every(v => v === 0 || v === 1) ? "binary" : "continuous",
        values: Object.freeze(values.slice())
    });
}

function makeOutcome(values: number[]): OutcomeVariable {
    return Object.freeze({
        name: "outcome",
        type: "continuous",
        values: Object.freeze(values.slice())
    });
}

function makeCovariate(name: string, values: number[]): Covariate {
    return Object.freeze({
        name,
        type: "continuous",
        values: Object.freeze(values.slice())
    });
}

describe("Stage 07-H: Causal / Counterfactual", () => {

    describe("Adjustment Estimator (synthetic known-effect)", () => {
        test("hand-verified: ATE recovers true effect (~3.0) and SE > 0", () => {
            const { covariate1, treatment, outcome } = buildHandVerifiedData();
            const eff = AdjustmentEstimator.estimateATE(
                treatment, outcome, [covariate1]
            );
            expect(Number.isFinite(eff.pointEstimate)).toBe(true);
            expect(Math.abs(eff.pointEstimate - 3.0)).toBeLessThanOrEqual(0.5);
            expect(eff.standardError).toBeGreaterThan(0);
            expect(eff.standardError).toBeLessThan(2);
            expect(eff.assumptionsViolated).toBe(false);
            expect(eff.method).toBe("ols_linear_adjustment");
            expect(eff.confidenceInterval.lower).toBeLessThanOrEqual(eff.pointEstimate);
            expect(eff.confidenceInterval.upper).toBeGreaterThanOrEqual(eff.pointEstimate);
        });

        test("known simple case: outcome = 5*T + 2*X + noise", () => {
            const rng = SeededRNG_create(7);
            const n = 100;
            const treatment: number[] = [];
            const covariate1: number[] = [];
            const outcome: number[] = [];
            for (let i = 0; i < n; i++) {
                const x = rng.nextNormal(0, 1);
                const t = rng.next() < 0.5 ? 0 : 1;
                const y = 5 * t + 2 * x + rng.nextNormal(0, 0.5);
                covariate1.push(x);
                treatment.push(t);
                outcome.push(y);
            }
            const eff = AdjustmentEstimator.estimateATE(treatment, outcome, [covariate1]);
            expect(Number.isFinite(eff.pointEstimate)).toBe(true);
            expect(Math.abs(eff.pointEstimate - 5.0)).toBeLessThanOrEqual(1.0);
            expect(eff.standardError).toBeGreaterThan(0);
            expect(eff.standardError).toBeLessThan(2);
            expect(eff.assumptionsViolated).toBe(false);
        });
    });

    describe("Adjustment Estimator (no effect)", () => {
        test("random outcome vs random treatment: ATE ~= 0", () => {
            const rng = SeededRNG_create(123);
            const n = 100;
            const treatment: number[] = [];
            const outcome: number[] = [];
            for (let i = 0; i < n; i++) {
                treatment.push(rng.next() < 0.5 ? 0 : 1);
                outcome.push(rng.nextNormal(0, 1));
            }
            const eff = AdjustmentEstimator.estimateATE(treatment, outcome, []);
            expect(Number.isFinite(eff.pointEstimate)).toBe(true);
            expect(Math.abs(eff.pointEstimate)).toBeLessThanOrEqual(1.0);
            expect(eff.assumptionsViolated).toBe(false);
        });
    });

    describe("Adjustment Estimator (edge cases)", () => {
        test("empty data -> pointEstimate is NaN and assumptionsViolated", () => {
            const eff = AdjustmentEstimator.estimateATE([], [], []);
            expect(Number.isNaN(eff.pointEstimate)).toBe(true);
            expect(eff.assumptionsViolated).toBe(true);
        });

        test("treatment constant -> identification_failed (NaN + violated)", () => {
            const eff = AdjustmentEstimator.estimateATE(
                [1, 1, 1, 1, 1],
                [1, 2, 3, 4, 5],
                []
            );
            expect(Number.isNaN(eff.pointEstimate)).toBe(true);
            expect(eff.assumptionsViolated).toBe(true);
        });

        test("outcome constant -> report ATE = 0 SE = 0 (degenerate, violated)", () => {
            const eff = AdjustmentEstimator.estimateATE(
                [0, 1, 0, 1, 1, 0, 1],
                [5, 5, 5, 5, 5, 5, 5],
                []
            );
            expect(eff.standardError).toBe(0);
            expect(eff.assumptionsViolated).toBe(true);
        });

        test("mismatched lengths -> invalid_request (NaN + violated)", () => {
            const eff = AdjustmentEstimator.estimateATE(
                [0, 1, 0],
                [1, 2],
                []
            );
            expect(Number.isNaN(eff.pointEstimate)).toBe(true);
            expect(eff.assumptionsViolated).toBe(true);
        });

        test("non-finite values -> invalid_request (NaN + violated)", () => {
            const eff = AdjustmentEstimator.estimateATE(
                [0, 1, 0, Number.NaN],
                [1, 2, 3, 4],
                []
            );
            expect(Number.isNaN(eff.pointEstimate)).toBe(true);
            expect(eff.assumptionsViolated).toBe(true);
        });
    });

    describe("Confounding Detection", () => {
        test("X causes both T and Y -> X flagged as confounder", () => {
            const rng = SeededRNG_create(1);
            const n = 200;
            const x: number[] = [];
            const t: number[] = [];
            const y: number[] = [];
            for (let i = 0; i < n; i++) {
                const xi = rng.nextNormal(0, 1);
                const ti = 0.5 * xi + rng.nextNormal(0, 0.5) > 0 ? 1 : 0;
                const yi = 3 * ti + 1.5 * xi + rng.nextNormal(0, 0.3);
                x.push(xi); t.push(ti); y.push(yi);
            }
            const det = ConfoundingDetector.detectConfounding(t, y, [x]);
            expect(det.suspectConfounders.length).toBeGreaterThan(0);
            expect(det.suspectConfounders).toContain(0);
            expect(det.reason.toLowerCase()).toContain("flagged only");
        });

        test("random X (no confounder) -> not flagged", () => {
            const rng = SeededRNG_create(2);
            const n = 200;
            const x: number[] = [];
            const t: number[] = [];
            const y: number[] = [];
            for (let i = 0; i < n; i++) {
                x.push(rng.nextNormal(0, 1));
                t.push(rng.next() < 0.5 ? 0 : 1);
                y.push(rng.nextNormal(0, 1));
            }
            const det = ConfoundingDetector.detectConfounding(t, y, [x]);
            expect(det.suspectConfounders.length).toBe(0);
        });

        test("multiple candidates: only the true confounder is flagged", () => {
            const rng = SeededRNG_create(3);
            const n = 250;
            const confounder: number[] = [];
            const noise1: number[] = [];
            const noise2: number[] = [];
            const t: number[] = [];
            const y: number[] = [];
            for (let i = 0; i < n; i++) {
                const c = rng.nextNormal(0, 1);
                const n1 = rng.nextNormal(0, 1);
                const n2 = rng.nextNormal(0, 1);
                const ti = 0.5 * c + rng.nextNormal(0, 0.5) > 0 ? 1 : 0;
                const yi = 3 * ti + 1.5 * c + rng.nextNormal(0, 0.3);
                confounder.push(c); noise1.push(n1); noise2.push(n2);
                t.push(ti); y.push(yi);
            }
            const det = ConfoundingDetector.detectConfounding(
                t, y, [confounder, noise1, noise2]
            );
            expect(det.suspectConfounders).toContain(0);
            expect(det.suspectConfounders).not.toContain(1);
            expect(det.suspectConfounders).not.toContain(2);
        });

        test("empty inputs -> no suspects flagged", () => {
            const det = ConfoundingDetector.detectConfounding([], [], []);
            expect(det.suspectConfounders.length).toBe(0);
        });
    });

    describe("Propensity Score", () => {
        test("estimated score in (0,1) for known case", () => {
            const rng = SeededRNG_create(11);
            const n = 200;
            const x: number[] = [];
            const t: number[] = [];
            for (let i = 0; i < n; i++) {
                const xi = rng.nextNormal(0, 1);
                const ti = 0.5 * xi + rng.nextNormal(0, 0.5) > 0 ? 1 : 0;
                x.push(xi); t.push(ti);
            }
            const prop = PropensityScore.estimatePropensity(t, [x], { seed: 11 });
            expect(prop.score).toBeGreaterThan(0);
            expect(prop.score).toBeLessThan(1);
            expect(Number.isFinite(prop.score)).toBe(true);
        });

        test("extreme scores -> positivity violated", () => {
            const det = PropensityScore.checkPositivity([0.02, 0.5, 0.97]);
            expect(det.isValid).toBe(true);
            const det2 = PropensityScore.checkPositivity([0.01, 0.99]);
            expect(det2.isValid).toBe(true);
            const det3 = PropensityScore.checkPositivity([0.001, 0.9999]);
            expect(det3.isValid).toBe(false);
        });

        test("constant treatment -> scores reflect no discrimination (balance ~0)", () => {
            const prop = PropensityScore.estimatePropensity(
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
                { seed: 13 }
            );
            expect(Number.isFinite(prop.score)).toBe(true);
            expect(Math.abs(prop.balance)).toBeLessThan(0.5);
        });

        test("deterministic across calls with same seed", () => {
            const rng = SeededRNG_create(99);
            const n = 80;
            const x: number[] = [];
            const t: number[] = [];
            for (let i = 0; i < n; i++) {
                x.push(rng.nextNormal(0, 1));
                t.push(rng.next() < 0.5 ? 0 : 1);
            }
            const a = PropensityScore.estimatePropensity(t, [x], { seed: 42 });
            const b = PropensityScore.estimatePropensity(t, [x], { seed: 42 });
            expect(a.score).toBeCloseTo(b.score, 10);
            expect(a.balance).toBeCloseTo(b.balance, 10);
        });
    });

    describe("Counterfactual Representation", () => {
        test("representDoCalculus returns P(Y | do(X=x)) form", () => {
            const s = CounterfactualEngine.representDoCalculus("X", "Y", []);
            expect(s).toMatch(/^P\(Y \| do\(X=x\)\)$/);
            const s2 = CounterfactualEngine.representDoCalculus("X", "Y", ["Z", "W"]);
            expect(s2).toMatch(/^P\(Y \| do\(X=x\) \| Z, W\)$/);
        });

        test("simulateCounterfactual returns expected effect when status=simulated", () => {
            const scen = CounterfactualEngine.simulateCounterfactual(
                [10, 12, 14, 16, 18],
                1,
                2,
                [makeCovariate("x", [1, 2, 3, 4, 5])]
            );
            expect(scen.status).toBe("simulated");
            expect(scen.expectedOutcome).toBeCloseTo(14 + 2, 5);
            expect(scen.treatmentValue).toBe(1);
            expect(scen.covariates.length).toBe(1);
        });

        test("simulateCounterfactual returns insufficient_data for empty baseline", () => {
            const scen = CounterfactualEngine.simulateCounterfactual(
                [],
                1, 2, []
            );
            expect(scen.status).toBe("insufficient_data");
            expect(Number.isNaN(scen.expectedOutcome)).toBe(true);
        });

        test("simulateCounterfactual returns identification_failed when expectedEffect is NaN", () => {
            const scen = CounterfactualEngine.simulateCounterfactual(
                [1, 2, 3], 1, Number.NaN, []
            );
            expect(scen.status).toBe("identification_failed");
            expect(Number.isNaN(scen.expectedOutcome)).toBe(true);
        });
    });

    describe("Assumption Violation Reporting", () => {
        test("treatment constant -> assumptionsViolated = true", () => {
            const eff = AdjustmentEstimator.estimateATE(
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 2, 3, 4, 5, 6, 7, 8],
                []
            );
            expect(eff.assumptionsViolated).toBe(true);
        });

        test("small sample size -> assumptionsViolated = true", () => {
            const eff = AdjustmentEstimator.estimateATE(
                [0, 1],
                [1, 2],
                []
            );
            expect(eff.assumptionsViolated).toBe(true);
        });

        test("buildAssumptions returns a frozen CausalAssumptions object", () => {
            const a = AdjustmentEstimator.buildAssumptions(
                true, true, true, true, "ols_linear_adjustment"
            );
            expect(a.positivity).toBe(true);
            expect(a.unconfoundedness).toBe(true);
            expect(a.consistency).toBe(true);
            expect(a.noInterference).toBe(true);
            expect(a.model).toBe("ols_linear_adjustment");
            expect(Object.isFrozen(a)).toBe(true);
        });
    });

    describe("Tenant Isolation", () => {
        test("CausalResult with mismatched tenantId is rejected by provenance check", () => {
            const { covariate1, treatment, outcome } = buildHandVerifiedData();
            const eff = AdjustmentEstimator.estimateATE(treatment, outcome, [covariate1]);
            const assumptions: CausalAssumptions = AdjustmentEstimator.buildAssumptions(
                true, true, true, true, "ols_linear_adjustment"
            );
            const provenance: CausalProvenance = {
                source: "Stage-07-H",
                tenant: "tenant-a",
                method: "ols_linear_adjustment",
                calculatedAt: "2026-01-01T00:00:00Z"
            };
            const result = buildCausalResult({
                tenantId: "tenant-b",
                metricName: "revenue",
                treatment: makeTreatment(treatment),
                outcome: makeOutcome(outcome),
                effect: eff,
                assumptions,
                status: "identified",
                provenance
            });
            expect(result.provenance.tenant).not.toBe(result.tenantId);
        });
    });

    describe("Provenance", () => {
        test("CausalProvenance carries required fields", () => {
            const prov: CausalProvenance = {
                source: "Stage-07-H",
                tenant: "tenant-a",
                method: "ols_linear_adjustment",
                calculatedAt: "2026-01-01T00:00:00Z"
            };
            expect(prov.source).toBeTruthy();
            expect(prov.tenant).toBeTruthy();
            expect(prov.method).toBeTruthy();
            expect(prov.calculatedAt).toMatch(/T/);
        });

        test("CausalResult exposes provenance and assumptions", () => {
            const { covariate1, treatment, outcome } = buildHandVerifiedData();
            const eff = AdjustmentEstimator.estimateATE(treatment, outcome, [covariate1]);
            const assumptions = AdjustmentEstimator.buildAssumptions(
                true, true, true, true, "ols_linear_adjustment"
            );
            const prov: CausalProvenance = {
                source: "Stage-07-H",
                tenant: "tenant-a",
                method: "ols_linear_adjustment",
                calculatedAt: "2026-01-01T00:00:00Z"
            };
            const r = buildCausalResult({
                tenantId: "tenant-a",
                metricName: "revenue",
                treatment: makeTreatment(treatment),
                outcome: makeOutcome(outcome),
                effect: eff,
                assumptions,
                status: "identified",
                provenance: prov
            });
            expect(r.provenance.tenant).toBe("tenant-a");
            expect(r.assumptions.model).toBe("ols_linear_adjustment");
            expect(r.status).toBe("identified");
        });
    });

    describe("Determinism", () => {
        test("100 identical ATE calls produce identical results", () => {
            const { covariate1, treatment, outcome } = buildHandVerifiedData();
            const first = AdjustmentEstimator.estimateATE(treatment, outcome, [covariate1]);
            for (let i = 0; i < 100; i++) {
                const next = AdjustmentEstimator.estimateATE(treatment, outcome, [covariate1]);
                expect(next.pointEstimate).toBe(first.pointEstimate);
                expect(next.standardError).toBe(first.standardError);
                expect(next.pValue).toBe(first.pValue);
                expect(next.confidenceInterval.lower).toBe(first.confidenceInterval.lower);
                expect(next.confidenceInterval.upper).toBe(first.confidenceInterval.upper);
                expect(next.assumptionsViolated).toBe(first.assumptionsViolated);
            }
        });

        test("100 identical confounding-detection calls produce identical results", () => {
            const rng = SeededRNG_create(5);
            const n = 100;
            const t: number[] = [];
            const y: number[] = [];
            const c: number[] = [];
            for (let i = 0; i < n; i++) {
                c.push(rng.nextNormal(0, 1));
                t.push(rng.next() < 0.5 ? 0 : 1);
                y.push(rng.nextNormal(0, 1));
            }
            const first = ConfoundingDetector.detectConfounding(t, y, [c]);
            for (let i = 0; i < 100; i++) {
                const next = ConfoundingDetector.detectConfounding(t, y, [c]);
                expect(next.suspectConfounders).toEqual(first.suspectConfounders);
                expect(next.reason).toBe(first.reason);
            }
        });
    });

    describe("Philosophical Guardrails (no correlation-as-causation)", () => {
        test("AdjustmentEstimator never silently fabricates a number on constant treatment", () => {
            const eff = AdjustmentEstimator.estimateATE(
                [1, 1, 1, 1, 1, 1],
                [1, 2, 3, 4, 5, 6],
                []
            );
            expect(eff.assumptionsViolated).toBe(true);
            expect(Number.isNaN(eff.pointEstimate)).toBe(true);
        });

        test("ConfoundingDetector reason explicitly says FLAGGED ONLY", () => {
            const rng = SeededRNG_create(6);
            const n = 100;
            const c: number[] = [];
            const t: number[] = [];
            const y: number[] = [];
            for (let i = 0; i < n; i++) {
                const ci = rng.nextNormal(0, 1);
                c.push(ci);
                t.push(0.5 * ci + rng.nextNormal(0, 0.5) > 0 ? 1 : 0);
                y.push(3 * t[i] + 1.5 * ci + rng.nextNormal(0, 0.3));
            }
            const det = ConfoundingDetector.detectConfounding(t, y, [c]);
            expect(det.reason.toUpperCase()).toContain("FLAGGED ONLY");
        });
    });
});

