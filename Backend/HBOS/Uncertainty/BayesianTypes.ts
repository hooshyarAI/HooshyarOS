/**
 * Stage 07-G - Bayesian / Optimization Types
 *
 * Type definitions for closed-form conjugate Bayesian updates,
 * posterior predictive checks, and deterministic optimization.
 *
 * IMPORTANT:
 * - No MCMC, no PyMC, no Stan — closed-form only
 * - No fabricated posterior probabilities
 * - All outputs are immutable (Object.freeze at construction)
 * - Tenant isolation enforced at every engine boundary
 * - Determinism: identical inputs produce identical outputs
 */

export type PriorType = "normal" | "beta" | "uniform" | "point";

export type LikelihoodType = "binomial" | "normal" | "poisson";

export type PosteriorDistributionType = "normal" | "beta" | "uniform" | "point";

export interface NormalPrior {
    readonly type: "normal";
    readonly mean: number;
    readonly variance: number;
    readonly description: string;
}

export interface BetaPrior {
    readonly type: "beta";
    readonly alpha: number;
    readonly beta: number;
    readonly description: string;
}

export interface UniformPrior {
    readonly type: "uniform";
    readonly lower: number;
    readonly upper: number;
    readonly description: string;
}

export interface PointPrior {
    readonly type: "point";
    readonly value: number;
    readonly description: string;
}

export type Prior = NormalPrior | BetaPrior | UniformPrior | PointPrior;

export interface NormalLikelihood {
    readonly type: "normal";
    readonly mean: number;
    readonly variance: number;
    readonly parameters?: {
        readonly values: number[];
        readonly knownVariance: number;
    };
}

export interface BinomialLikelihood {
    readonly type: "binomial";
    readonly parameters: {
        readonly successes: number;
        readonly trials: number;
    };
}

export interface PoissonLikelihood {
    readonly type: "poisson";
    readonly lambda: number;
}

export type Likelihood = NormalLikelihood | BinomialLikelihood | PoissonLikelihood;

export interface NormalPosterior {
    readonly distribution: "normal";
    readonly mean: number;
    readonly variance: number;
}

export interface BetaPosterior {
    readonly distribution: "beta";
    readonly alpha: number;
    readonly beta: number;
}

export interface UniformPosterior {
    readonly distribution: "uniform";
    readonly lower: number;
    readonly upper: number;
}

export interface PointPosterior {
    readonly distribution: "point";
    readonly value: number;
}

export type Posterior = NormalPosterior | BetaPosterior | UniformPosterior | PointPosterior;

export interface CredibleInterval {
    readonly lower: number;
    readonly upper: number;
    readonly level: number;
    readonly method: "normal_z_score" | "beta_exact" | "uniform" | "point";
}

export interface BayesianUpdate {
    readonly prior: Prior;
    readonly likelihood: Likelihood;
    readonly posterior: Posterior;
    readonly evidenceCount: number;
    readonly logLikelihood: number;
    readonly provenance: BayesianProvenance;
}

export interface ObjectiveFunction {
    readonly type: "minimize" | "maximize";
    evaluate(x: ReadonlyArray<number>): number;
}

export type ConstraintType = "bound" | "linear";

export interface BoundConstraint {
    readonly type: "bound";
    readonly variableIndex: number;
    readonly lower: number;
    readonly upper: number;
}

export interface LinearConstraint {
    readonly type: "linear";
    readonly coefficients: ReadonlyArray<number>;
    readonly bound: number;
    readonly inequality: "<=" | ">=";
}

export type Constraint = BoundConstraint | LinearConstraint;

export type OptimizationStatus = "optimal" | "infeasible" | "max_iterations" | "converged";

export interface OptimizationResult {
    readonly status: OptimizationStatus;
    readonly solution: ReadonlyArray<number> | null;
    readonly objectiveValue: number;
    readonly iterations: number;
    readonly convergenceDelta: number | null;
    readonly error?: string;
    readonly provenance: BayesianProvenance;
}

export interface BayesianProvenance {
    readonly source: string;
    readonly tenant: string;
    readonly prior: Prior;
    readonly likelihood: Likelihood;
    readonly method: string;
    readonly calculatedAt: string;
}
