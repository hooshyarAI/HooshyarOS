/**
 * Stage 07-H - Propensity Score (Simplified)
 *
 * For binary treatment T in {0,1} and covariates X, the propensity score
 * is defined as e(X) = P(T = 1 | X). A common parametric model is
 *
 *     logit(e(X)) = alpha + beta^T X
 *
 * i.e. e(X) = sigmoid(alpha + beta^T X).
 *
 * IMPORTANT:
 *  - This is a SIMPLIFIED propensity estimator.
 *  - It uses a small-batch gradient descent on the Bernoulli
 *    log-likelihood with an L2 penalty. It is NOT a state-of-the-art
 *    fitter; it is deliberately simple and dependency-free.
 *  - Positivity (overlap) is checked separately via `checkPositivity`.
 *  - No use of any external causal-inference library.
 *
 * METHOD (coordinate-free gradient descent on log-likelihood):
 *   For each (x_i, t_i):
 *     z_i = alpha + beta . x_i
 *     p_i = sigmoid(z_i)
 *     gradient_alpha += (p_i - t_i)
 *     gradient_beta[j] += (p_i - t_i) * x_i[j]
 *   update: alpha -= lr * gradient_alpha / n
 *           beta  -= lr * (gradient_beta - lambda * beta) / n
 *   repeat for nIter iterations.
 */

import { SeededRNG_create } from "./SeededRNG";

const DEFAULT_LR = 0.1;
const DEFAULT_LAMBDA = 0.01;
const DEFAULT_ITER = 500;

export interface PropensityResult {
    readonly score: number;
    readonly balance: number;
}

export const PropensityScore = {
    estimatePropensity(
        treatment: ReadonlyArray<number>,
        covariates: ReadonlyArray<ReadonlyArray<number>>,
        options?: { learningRate?: number; l2Penalty?: number; iterations?: number; seed?: number }
    ): PropensityResult {
        const n = treatment.length;
        if (!treatment || n === 0) {
            return { score: NaN, balance: NaN };
        }
        if (!covariates || covariates.length === 0) {
            return { score: NaN, balance: NaN };
        }
        const p = covariates.length;
        for (let i = 0; i < p; i++) {
            if (covariates[i].length !== n) {
                return { score: NaN, balance: NaN };
            }
        }

        const lr = options?.learningRate ?? DEFAULT_LR;
        const lambda = options?.l2Penalty ?? DEFAULT_LAMBDA;
        const iters = options?.iterations ?? DEFAULT_ITER;
        const rng = SeededRNG_create(options?.seed ?? 42);

        let alpha = 0;
        const beta: number[] = new Array<number>(p).fill(0);
        for (let j = 0; j < p; j++) {
            beta[j] = (rng.next() - 0.5) * 0.01;
        }

        const sig = (z: number) => 1 / (1 + Math.exp(-z));

        for (let it = 0; it < iters; it++) {
            let gAlpha = 0;
            const gBeta: number[] = new Array<number>(p).fill(0);
            for (let i = 0; i < n; i++) {
                let z = alpha;
                for (let j = 0; j < p; j++) {
                    z += beta[j] * covariates[j][i];
                }
                const pi = sig(z);
                const diff = pi - treatment[i];
                gAlpha += diff;
                for (let j = 0; j < p; j++) {
                    gBeta[j] += diff * covariates[j][i];
                }
            }
            alpha -= lr * gAlpha / n;
            for (let j = 0; j < p; j++) {
                beta[j] -= lr * (gBeta[j] - lambda * beta[j]) / n;
            }
        }

        let sumScores = 0;
        let balance = 0;
        for (let i = 0; i < n; i++) {
            let z = alpha;
            for (let j = 0; j < p; j++) {
                z += beta[j] * covariates[j][i];
            }
            const pi = sig(z);
            sumScores += pi;
            const w = treatment[i] - (1 - treatment[i]);
            balance += w * pi;
        }
        const score = sumScores / n;

        return { score, balance: balance / n };
    },

    checkPositivity(
        scores: ReadonlyArray<number>,
        epsLow: number = 0.01,
        epsHigh: number = 0.99
    ): { isValid: boolean; minScore: number; maxScore: number } {
        if (!scores || scores.length === 0) {
            return { isValid: false, minScore: NaN, maxScore: NaN };
        }
        let lo = Infinity;
        let hi = -Infinity;
        for (let i = 0; i < scores.length; i++) {
            const v = scores[i];
            if (!Number.isFinite(v)) { continue; }
            if (v < lo) { lo = v; }
            if (v > hi) { hi = v; }
        }
        if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
            return { isValid: false, minScore: NaN, maxScore: NaN };
        }
        const isValid = lo >= epsLow && hi <= epsHigh;
        return { isValid, minScore: lo, maxScore: hi };
    }
};


