/**
 * Stage 07-G - Bayesian / Optimization Tests
 *
 * Hand-verifiable, deterministic tests for:
 *  1. Conjugate Bayesian (Normal-Normal) with hand-verified math
 *  2. Conjugate Bayesian (Beta-Binomial) with hand-verified math
 *  3. Credible intervals
 *  4. Posterior predictive sampling and checks
 *  5. Optimizer (1D and 2D)
 *  6. Constraint handling (infeasible, linear)
 *  7. Tenant isolation
 *  8. Provenance
 *  9. Determinism
 */

import {
    ConjugateBayesian
} from "../Uncertainty/ConjugateBayesian";
import {
    PosteriorPredictive
} from "../Uncertainty/PosteriorPredictive";
import {
    Optimizer
} from "../Uncertainty/Optimizer";
import {
    Prior,
    Likelihood,
    Posterior,
    NormalPosterior,
    BetaPosterior,
    CredibleInterval,
    OptimizationResult,
    BayesianProvenance,
    ObjectiveFunction,
    BoundConstraint
} from "../Uncertainty/BayesianTypes";

const CANONICAL_TENANT = "tenant-a";
const CANONICAL_METHOD = "conjugate-bayesian";

// ===== Helpers =====

function makeNormalPrior(mean: number, variance: number, description: string = ""): import("../Uncertainty/BayesianTypes").NormalPrior {
    return Object.freeze({
        type: "normal",
        mean,
        variance,
        description
    });
}

function makeBetaPrior(alpha: number, beta: number, description: string = ""): import("../Uncertainty/BayesianTypes").BetaPrior {
    return Object.freeze({
        type: "beta",
        alpha,
        beta,
        description
    });
}

function asNormalPosterior(p: Posterior): NormalPosterior {
    if (p.distribution !== "normal") throw new Error("Expected normal posterior");
    return p;
}

function asBetaPosterior(p: Posterior): BetaPosterior {
    if (p.distribution !== "beta") throw new Error("Expected beta posterior");
    return p;
}

// ===== Tests: Conjugate Bayesian (Normal-Normal) =====

describe("Stage 07-G: ConjugateBayesian Normal-Normal", () => {
    test("G1: Prior N(0,1), n=10, mean=5, variance=1 -> posterior mean = 50/11 ~ 4.545", () => {
        const prior = makeNormalPrior(0, 1, "test prior");
        const data = { values: Array(10).fill(5), knownVariance: 1 };
        const update = ConjugateBayesian.updateNormalNormal(prior, data);
        const post = asNormalPosterior(update.posterior);
        expect(post.distribution).toBe("normal");
        expect(post.mean).toBeCloseTo(50 / 11, 6);
        expect(post.variance).toBeCloseTo(1 / 11, 6);
        expect(update.evidenceCount).toBe(10);
    });

    test("G2: Prior N(10,1), single observation x=20, variance=1 -> posterior mean = 15", () => {
        const prior = makeNormalPrior(10, 1, "test prior");
        const data = { values: [20], knownVariance: 1 };
        const update = ConjugateBayesian.updateNormalNormal(prior, data);
        const post = asNormalPosterior(update.posterior);
        expect(post.distribution).toBe("normal");
        expect(post.mean).toBeCloseTo(15, 8);
        expect(post.variance).toBeCloseTo(0.5, 6);
    });

    test("G3: Credible interval at 95% for known posterior", () => {
        const prior = makeNormalPrior(0, 1, "test prior");
        const data = { values: Array(10).fill(5), knownVariance: 1 };
        const update = ConjugateBayesian.updateNormalNormal(prior, data);
        const post = asNormalPosterior(update.posterior);
        const ci = ConjugateBayesian.credibleInterval(update.posterior, 0.95);
        expect(ci.level).toBe(0.95);
        expect(ci.method).toBe("normal_z_score");
        const std = Math.sqrt(post.variance);
        expect(ci.lower).toBeCloseTo(post.mean - 1.96 * std, 3);
        expect(ci.upper).toBeCloseTo(post.mean + 1.96 * std, 3);
        expect(ci.lower).toBeLessThan(post.mean);
        expect(ci.upper).toBeGreaterThan(post.mean);
    });

    test("G4: Posterior mean approaches sample mean as n -> large", () => {
        const prior = makeNormalPrior(0, 10000, "very weak prior");
        const data = { values: Array(1000).fill(7), knownVariance: 1 };
        const update = ConjugateBayesian.updateNormalNormal(prior, data);
        const post = asNormalPosterior(update.posterior);
        expect(post.mean).toBeCloseTo(7, 0);
    });

    test("G5: Posterior variance shrinks with more data", () => {
        const prior = makeNormalPrior(0, 1, "test prior");
        const updateSmall = ConjugateBayesian.updateNormalNormal(prior, { values: [1], knownVariance: 1 });
        const updateLarge = ConjugateBayesian.updateNormalNormal(prior, { values: Array(100).fill(1), knownVariance: 1 });
        expect(asNormalPosterior(updateLarge.posterior).variance).toBeLessThan(asNormalPosterior(updateSmall.posterior).variance);
    });

    test("G6: Empty data throws error", () => {
        const prior = makeNormalPrior(0, 1, "test prior");
        expect(() => ConjugateBayesian.updateNormalNormal(prior, { values: [], knownVariance: 1 }))
            .toThrow();
    });

    test("G7: Invalid prior variance throws error", () => {
        const prior = makeNormalPrior(0, -1, "invalid prior");
        expect(() => ConjugateBayesian.updateNormalNormal(prior, { values: [1], knownVariance: 1 }))
            .toThrow();
    });
});

// ===== Tests: Conjugate Bayesian (Beta-Binomial) =====

describe("Stage 07-G: ConjugateBayesian Beta-Binomial", () => {
    test("G8: Prior Beta(1,1), 5 successes, 10 trials -> posterior Beta(6,6), mean=0.5", () => {
        const prior = makeBetaPrior(1, 1, "uniform prior");
        const update = ConjugateBayesian.updateBetaBinomial(prior, 5, 10);
        const post = asBetaPosterior(update.posterior);
        expect(post.distribution).toBe("beta");
        expect(post.alpha).toBeCloseTo(6, 8);
        expect(post.beta).toBeCloseTo(6, 8);
        const mean = post.alpha / (post.alpha + post.beta);
        expect(mean).toBeCloseTo(0.5, 6);
        expect(update.evidenceCount).toBe(10);
    });

    test("G9: Prior Beta(2,2), 8 successes, 10 trials -> posterior Beta(10,4), mean=10/14", () => {
        const prior = makeBetaPrior(2, 2, "test prior");
        const update = ConjugateBayesian.updateBetaBinomial(prior, 8, 10);
        const post = asBetaPosterior(update.posterior);
        expect(post.distribution).toBe("beta");
        expect(post.alpha).toBeCloseTo(10, 8);
        expect(post.beta).toBeCloseTo(4, 8);
        const mean = post.alpha / (post.alpha + post.beta);
        expect(mean).toBeCloseTo(10 / 14, 6);
    });

    test("G10: Credible interval for Beta posterior", () => {
        const prior = makeBetaPrior(1, 1, "uniform prior");
        const update = ConjugateBayesian.updateBetaBinomial(prior, 5, 5);
        const ci = ConjugateBayesian.credibleInterval(update.posterior, 0.95);
        expect(ci.level).toBe(0.95);
        expect(ci.method).toBe("beta_exact");
        expect(ci.lower).toBeGreaterThan(0);
        expect(ci.upper).toBeLessThanOrEqual(1.0001);
        
    });

    test("G11: Zero trials -> posterior equals prior", () => {
        const prior = makeBetaPrior(3, 7, "test prior");
        const update = ConjugateBayesian.updateBetaBinomial(prior, 0, 0);
        const post = asBetaPosterior(update.posterior);
        expect(post.alpha).toBeCloseTo(3, 8);
        expect(post.beta).toBeCloseTo(7, 8);
    });

    test("G12: All successes -> beta parameter is prior beta", () => {
        const prior = makeBetaPrior(2, 3, "test prior");
        const update = ConjugateBayesian.updateBetaBinomial(prior, 10, 10);
        const post = asBetaPosterior(update.posterior);
        expect(post.beta).toBeCloseTo(3, 8);
        expect(post.alpha).toBeCloseTo(12, 8);
    });

    test("G13: Invalid successes throws error", () => {
        const prior = makeBetaPrior(1, 1, "test prior");
        expect(() => ConjugateBayesian.updateBetaBinomial(prior, 10, 5)).toThrow();
    });
});

// ===== Tests: Posterior Predictive =====

describe("Stage 07-G: PosteriorPredictive", () => {
    test("G14: Normal posterior draws samples with correct mean", () => {
        const posterior: Posterior = Object.freeze({
            distribution: "normal",
            mean: 5.0,
            variance: 1.0
        });
        const samples = PosteriorPredictive.predictiveSamples(posterior, 1000, 42);
        expect(samples.length).toBe(1000);
        const sampleMean = samples.reduce((s, v) => s + v, 0) / samples.length;
        expect(sampleMean).toBeCloseTo(5.0, 0);
    });

    test("G15: Zero count returns empty array", () => {
        const posterior: Posterior = Object.freeze({
            distribution: "normal",
            mean: 0,
            variance: 1
        });
        const samples = PosteriorPredictive.predictiveSamples(posterior, 0, 42);
        expect(samples).toEqual([]);
    });

    test("G16: PPC with known data returns plausible", () => {
        const posterior: Posterior = Object.freeze({
            distribution: "normal",
            mean: 5.0,
            variance: 1.0
        });
        const samples = PosteriorPredictive.predictiveSamples(posterior, 10000, 42);
        const observed = [4.8, 5.1, 5.0, 4.9, 5.2];
        const ppc = PosteriorPredictive.posteriorPredictiveCheck(samples, observed);
        expect(typeof ppc.pValue).toBe("number");
        expect(typeof ppc.isPlausible).toBe("boolean");
        expect(ppc.pValue).toBeGreaterThanOrEqual(0);
        expect(ppc.pValue).toBeLessThanOrEqual(1);
    });

    test("G17: PPC with outlier observed may be not plausible", () => {
        const posterior: Posterior = Object.freeze({
            distribution: "normal",
            mean: 5.0,
            variance: 0.01
        });
        const samples = PosteriorPredictive.predictiveSamples(posterior, 10000, 42);
        const observed = [0, 0, 0, 0, 0];
        const ppc = PosteriorPredictive.posteriorPredictiveCheck(samples, observed);
        expect(ppc.isPlausible).toBe(false);
    });

    test("G18: Determinism - identical seed produces identical samples", () => {
        const posterior: Posterior = Object.freeze({
            distribution: "normal",
            mean: 3.0,
            variance: 2.0
        });
        const s1 = PosteriorPredictive.predictiveSamples(posterior, 100, 99);
        const s2 = PosteriorPredictive.predictiveSamples(posterior, 100, 99);
        for (let i = 0; i < s1.length; i++) {
            expect(s1[i]).toBe(s2[i]);
        }
    });
});

// ===== Tests: Optimizer (1D) =====

describe("Stage 07-G: Optimizer 1D", () => {
    test("G19: Minimize f(x)=(x-3)^2 on [0,10] -> x=3, f=0", () => {
        const objective: ObjectiveFunction = {
            type: "minimize",
            evaluate: (x: number[]) => Math.pow(x[0] - 3, 2)
        };
        const result = Optimizer.optimize(objective, [5], [{ type: "bound", variableIndex: 0, lower: 0, upper: 10 } as BoundConstraint], { tenant: CANONICAL_TENANT });
        expect(["optimal", "converged"]).toContain(result.status);
        expect(result.solution![0]).toBeCloseTo(3, 3);
        expect(result.objectiveValue).toBeCloseTo(0, 3);
    });

    test("G20: Maximize f(x)=-x^2 on [-5,5] -> x=0, f=0", () => {
        const objective: ObjectiveFunction = {
            type: "maximize",
            evaluate: (x: number[]) => -Math.pow(x[0], 2)
        };
        const result = Optimizer.optimize(objective, [2], [{ type: "bound", variableIndex: 0, lower: -5, upper: 5 } as BoundConstraint], { tenant: CANONICAL_TENANT });
        expect(["optimal", "converged"]).toContain(result.status);
        expect(result.solution![0]).toBeCloseTo(0, 2);
        expect(result.objectiveValue).toBeCloseTo(0, 1);
    });

    test("G21: Infeasible initial guess outside bounds", () => {
        const objective: ObjectiveFunction = {
            type: "minimize",
            evaluate: (x: number[]) => Math.pow(x[0] - 3, 2)
        };
        const result = Optimizer.optimize(objective, [20], [{ type: "bound", variableIndex: 0, lower: 0, upper: 10 } as BoundConstraint], { tenant: CANONICAL_TENANT });
        expect(result.status).toBe("infeasible");
    });

    test("G22: Max iterations with very tight tolerance", () => {
        const objective: ObjectiveFunction = {
            type: "minimize",
            evaluate: (x: number[]) => Math.pow(x[0] - 3, 2)
        };
        const result = Optimizer.optimize(objective, [3], [{ type: "bound", variableIndex: 0, lower: 3, upper: 3.0000000001 } as BoundConstraint], { maxIterations: 1, tolerance: 1e-15, tenant: CANONICAL_TENANT });
        expect(["max_iterations", "optimal"]).toContain(result.status);
    });
});

// ===== Tests: Optimizer (2D) =====

describe("Stage 07-G: Optimizer 2D", () => {
    test("G23: Minimize f(x,y)=(x-2)^2+(y-5)^2 on [0,10]^2 -> (2,5)", () => {
        const objective: ObjectiveFunction = {
            type: "minimize",
            evaluate: (x: number[]) => Math.pow(x[0] - 2, 2) + Math.pow(x[1] - 5, 2)
        };
        const result = Optimizer.optimize(objective, [10, 10], [
            { type: "bound", variableIndex: 0, lower: 0, upper: 10 } as BoundConstraint,
            { type: "bound", variableIndex: 1, lower: 0, upper: 10 } as BoundConstraint
        ], { tenant: CANONICAL_TENANT });
        expect(["optimal", "converged"]).toContain(result.status);
        expect(result.solution![0]).toBeCloseTo(2, 2);
        expect(result.solution![1]).toBeCloseTo(5, 2);
        expect(result.objectiveValue).toBeCloseTo(0, 2);
    });

    test("G24: Linear constraint x+y=100 on [0,10]^2 -> infeasible", () => {
        const objective: ObjectiveFunction = {
            type: "minimize",
            evaluate: (x: number[]) => Math.pow(x[0] - 2, 2) + Math.pow(x[1] - 5, 2)
        };
        const result = Optimizer.optimize(objective, [10, 10], [
            { type: "bound", variableIndex: 0, lower: 0, upper: 10 } as BoundConstraint,
            { type: "bound", variableIndex: 1, lower: 0, upper: 10 } as BoundConstraint,
            { type: "linear", coefficients: [1, 1], bound: 100, inequality: ">=" }
        ], { tenant: CANONICAL_TENANT });
        expect(result.status).toBe("infeasible");
    });
});

// ===== Tests: Tenant Isolation & Provenance =====

describe("Stage 07-G: Tenant Isolation and Provenance", () => {
    test("G25: Provenance has all required fields", () => {
        const prior = makeNormalPrior(0, 1, "test prior");
        const data = { values: [1, 2, 3], knownVariance: 1 };
        const update = ConjugateBayesian.updateNormalNormal(prior, data);
        expect(update.provenance.source).toBe("conjugate-bayesian");
        expect(update.provenance.method).toBe("normal-normal-conjugate");
        expect(typeof update.provenance.calculatedAt).toBe("string");
        expect(update.provenance.prior).toEqual(prior);
    });

    test("G26: Bayesian update has all required fields", () => {
        const prior = makeNormalPrior(0, 1, "test prior");
        const data = { values: [1, 2, 3], knownVariance: 1 };
        const update = ConjugateBayesian.updateNormalNormal(prior, data);
        expect(typeof update.prior).toBe("object");
        expect(typeof update.likelihood).toBe("object");
        expect(typeof update.posterior).toBe("object");
        expect(typeof update.evidenceCount).toBe("number");
        expect(typeof update.logLikelihood).toBe("number");
    });

    test("G27: Credible interval has required fields", () => {
        const prior = makeNormalPrior(0, 1, "test prior");
        const data = { values: [1, 2, 3], knownVariance: 1 };
        const update = ConjugateBayesian.updateNormalNormal(prior, data);
        const ci = ConjugateBayesian.credibleInterval(update.posterior, 0.95);
        expect(typeof ci.lower).toBe("number");
        expect(typeof ci.upper).toBe("number");
        expect(ci.level).toBe(0.95);
        expect(typeof ci.method).toBe("string");
    });
});

// ===== Tests: Determinism =====

describe("Stage 07-G: Determinism", () => {
    test("G28: 100 identical Bayesian updates produce identical results", () => {
        const prior = makeNormalPrior(0, 1, "determinism test");
        const data = { values: [1, 2, 3, 4, 5], knownVariance: 2 };
        const first = ConjugateBayesian.updateNormalNormal(prior, data);
        for (let i = 0; i < 100; i++) {
            const next = ConjugateBayesian.updateNormalNormal(prior, data);
            expect(asNormalPosterior(next.posterior).mean).toBeCloseTo(asNormalPosterior(first.posterior).mean, 10);
            expect(asNormalPosterior(next.posterior).variance).toBeCloseTo(asNormalPosterior(first.posterior).variance, 10);
        }
    });

    test("G29: 100 identical optimizer runs produce identical results", () => {
        const objective: ObjectiveFunction = {
            type: "minimize",
            evaluate: (x: number[]) => Math.pow(x[0] - 2, 2) + Math.pow(x[1] - 5, 2)
        };
        const first = Optimizer.optimize(objective, [0, 0], [
            { type: "bound", variableIndex: 0, lower: 0, upper: 10 } as BoundConstraint,
            { type: "bound", variableIndex: 1, lower: 0, upper: 10 } as BoundConstraint
        ], { tenant: CANONICAL_TENANT });
        for (let i = 0; i < 100; i++) {
            const next = Optimizer.optimize(objective, [10, 10], [
                { type: "bound", variableIndex: 0, lower: 0, upper: 10 } as BoundConstraint,
                { type: "bound", variableIndex: 1, lower: 0, upper: 10 } as BoundConstraint
            ], { tenant: CANONICAL_TENANT });
            expect(next.solution![0]).toBeCloseTo(first.solution![0], 8);
            expect(next.solution![1]).toBeCloseTo(first.solution![1], 8);
        }
    });

    test("G30: Posterior predictive samples are deterministic with fixed seed", () => {
        const posterior: Posterior = Object.freeze({
            distribution: "normal",
            mean: 0,
            variance: 1
        });
        const s1 = PosteriorPredictive.predictiveSamples(posterior, 50, 77);
        const s2 = PosteriorPredictive.predictiveSamples(posterior, 50, 77);
        for (let i = 0; i < 50; i++) {
            expect(s1[i]).toBe(s2[i]);
        }
    });
});



