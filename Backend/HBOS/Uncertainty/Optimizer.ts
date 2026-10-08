/**
 * Stage 07-G - Deterministic Optimizer
 *
 * Gradient-free optimization for small-dimensional problems.
 *
 * METHODS:
 *   1D: Golden-section search (for unimodal functions on [a, b])
 *       - Minimization only; maximization handled by negating objective
 *       - Requires bound constraints
 *       - Converges when interval width < tolerance
 *
 *   ND (N >= 2): Coordinate descent
 *       - Iteratively optimize one coordinate at a time
 *       - For each coordinate, use 1D golden-section search over its bounds
 *       - Repeats until convergence or max iterations
 *
 * STATUSES:
 *   - "optimal"      : solution found within tolerance
 *   - "converged"    : solution found, stopped early (same as optimal for this implementation)
 *   - "max_iterations": stopped before converging
 *   - "infeasible"   : initial guess violates constraints
 *
 * CONSTRAINT HANDLING:
 *   - Bound constraints: solution clipped to bounds after each step
 *   - Linear constraints: checked for feasibility before optimization; return infeasible if violated
 *
 * IMPORTANT:
 * - No derivative-based methods (gradient-free only)
 * - No MCMC or stochastic optimization
 * - Deterministic: identical inputs produce identical outputs
 * - No external dependencies
 * - Tenant isolation enforced via provenance
 */

import {
    ObjectiveFunction,
    Constraint,
    OptimizationResult,
    OptimizationStatus,
    BoundConstraint,
    LinearConstraint,
    BayesianProvenance
} from "./BayesianTypes";

const CANONICAL_TIMESTAMP = "2026-01-01T00:00:00Z";

const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;
const GOLDEN_RATIO_INV = 1 / GOLDEN_RATIO;
const DEFAULT_TOLERANCE = 1e-9;
const DEFAULT_MAX_ITERATIONS = 1000;

export const Optimizer = {
    optimize(
        objective: ObjectiveFunction,
        initialGuess: number[],
        constraints: Constraint[],
        options: {
            maxIterations?: number;
            tolerance?: number;
            tenant?: string;
        } = {}
    ): OptimizationResult {
        const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
        const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
        const tenant = options.tenant ?? "";

        const n = initialGuess.length;

        if (n === 0) {
            return buildResult(
                "infeasible",
                null,
                objective.evaluate([]),
                0,
                null,
                "initialGuess is empty",
                tenant,
                objective
            );
        }

        for (const v of initialGuess) {
            if (!Number.isFinite(v)) {
                return buildResult(
                    "infeasible",
                    null,
                    objective.evaluate(initialGuess),
                    0,
                    null,
                    "initialGuess contains non-finite values",
                    tenant,
                    objective
                );
            }
        }

        const boundConstraints: BoundConstraint[] = [];
        const linearConstraints: LinearConstraint[] = [];
        for (const c of constraints) {
            if (c.type === "bound") boundConstraints.push(c);
            else if (c.type === "linear") linearConstraints.push(c);
        }

        if (!isFeasible(initialGuess, boundConstraints, linearConstraints)) {
            return buildResult(
                "infeasible",
                null,
                objective.evaluate(initialGuess),
                0,
                null,
                "Initial guess violates constraints",
                tenant,
                objective
            );
        }

        if (n === 1) {
            return optimize1D(objective, initialGuess[0], boundConstraints, maxIterations, tolerance, tenant);
        }

        return optimizeND(objective, initialGuess, boundConstraints, linearConstraints, maxIterations, tolerance, tenant);
    }
};

function optimize1D(
    objective: ObjectiveFunction,
    initial: number,
    bounds: BoundConstraint[],
    maxIterations: number,
    tolerance: number,
    tenant: string
): OptimizationResult {
    const bound = bounds.find(b => b.variableIndex === 0);
    if (!bound) {
        return buildResult(
            "infeasible",
            [initial],
            objective.evaluate([initial]),
            0,
            null,
            "No bound constraint for 1D optimization",
            tenant,
            objective
        );
    }

    let a = bound.lower;
    let b = bound.upper;
    let iterations = 0;

    while ((b - a) > tolerance && iterations < maxIterations) {
        const c = b - (b - a) / GOLDEN_RATIO;
        const d = a + (b - a) / GOLDEN_RATIO;

        const fc = objective.evaluate([c]);
        const fd = objective.evaluate([d]);

        if (objective.type === "minimize") {
            if (fc < fd) {
                b = d;
            } else {
                a = c;
            }
        } else {
            if (fc > fd) {
                b = d;
            } else {
                a = c;
            }
        }

        iterations++;
    }

    const xOpt = (a + b) / 2;
    const fOpt = objective.evaluate([xOpt]);
    const delta = b - a;

    const status: OptimizationStatus = delta <= tolerance ? "optimal" : "max_iterations";

    return buildResult(
        status,
        [xOpt],
        fOpt,
        iterations,
        delta,
        undefined,
        tenant,
        objective
    );
}

function optimizeND(
    objective: ObjectiveFunction,
    initial: number[],
    bounds: BoundConstraint[],
    linearConstraints: LinearConstraint[],
    maxIterations: number,
    tolerance: number,
    tenant: string
): OptimizationResult {
    let x = [...initial];
    let iterations = 0;
    const n = x.length;

    while (iterations < maxIterations) {
        let maxDelta = 0;

        for (let i = 0; i < n; i++) {
            const bound = bounds.find(b => b.variableIndex === i);
            if (!bound) continue;

            const fixedX = [...x];
            const goldenResult = goldenSectionLineSearch(objective, fixedX, i, bound.lower, bound.upper, tolerance);
            const newVal = goldenResult.solution[i];
            maxDelta = Math.max(maxDelta, Math.abs(newVal - x[i]));
            x[i] = newVal;
        }

        if (maxDelta < tolerance) {
            return buildResult(
                "converged",
                x,
                objective.evaluate(x),
                iterations,
                maxDelta,
                undefined,
                tenant,
                objective
            );
        }

        iterations++;
    }

    return buildResult(
        "max_iterations",
        x,
        objective.evaluate(x),
        iterations,
        null,
        undefined,
        tenant,
        objective
    );
}

function goldenSectionLineSearch(
    objective: ObjectiveFunction,
    fixedX: number[],
    varIndex: number,
    lower: number,
    upper: number,
    tolerance: number
): OptimizationResult {
    let a = lower;
    let b = upper;
    let iter = 0;

    while ((b - a) > tolerance && iter < DEFAULT_MAX_ITERATIONS) {
        const c = b - (b - a) / GOLDEN_RATIO;
        const d = a + (b - a) / GOLDEN_RATIO;

        fixedX[varIndex] = c;
        const fc = objective.evaluate(fixedX);
        fixedX[varIndex] = d;
        const fd = objective.evaluate(fixedX);

        if (objective.type === "minimize") {
            if (fc < fd) {
                b = d;
            } else {
                a = c;
            }
        } else {
            if (fc > fd) {
                b = d;
            } else {
                a = c;
            }
        }

        iter++;
    }

    const xOpt = (a + b) / 2;
    fixedX[varIndex] = xOpt;
    return {
        status: "optimal",
        solution: fixedX,
        objectiveValue: objective.evaluate(fixedX),
        iterations: iter,
        convergenceDelta: b - a,
        provenance: {} as BayesianProvenance
    };
}

function isFeasible(
    x: number[],
    bounds: BoundConstraint[],
    linearConstraints: LinearConstraint[]
): boolean {
    for (const b of bounds) {
        if (x[b.variableIndex] < b.lower || x[b.variableIndex] > b.upper) {
            return false;
        }
    }
    for (const lc of linearConstraints) {
        let val = 0;
        for (let i = 0; i < lc.coefficients.length && i < x.length; i++) {
            val += lc.coefficients[i] * x[i];
        }
        if (lc.inequality === "<=" && val > lc.bound + 1e-12) return false;
        if (lc.inequality === ">=" && val < lc.bound - 1e-12) return false;
        if (lc.inequality === "<=" && Math.abs(val - lc.bound) <= 1e-12) continue;
        if (lc.inequality === ">=" && Math.abs(val - lc.bound) <= 1e-12) continue;
    }
    return true;
}

function buildResult(
    status: OptimizationStatus,
    solution: number[] | null,
    objectiveValue: number,
    iterations: number,
    convergenceDelta: number | null,
    error: string | undefined,
    tenant: string,
    objective: ObjectiveFunction
): OptimizationResult {
    const provenance: BayesianProvenance = Object.freeze({
        source: "optimizer",
        tenant,
        prior: Object.freeze({
            type: "uniform",
            lower: 0,
            upper: 1,
            description: "default prior"
        }),
        likelihood: Object.freeze({
            type: "normal",
            mean: 0,
            variance: 1
        }),
        method: "coordinate-descent-golden-section",
        calculatedAt: CANONICAL_TIMESTAMP
    });

    const result: any = {
        status,
        solution: solution ? Object.freeze([...solution]) : null,
        objectiveValue,
        iterations,
        convergenceDelta,
        provenance
    };

    if (error) {
        result.error = error;
    }

    return Object.freeze(result) as OptimizationResult;
}

