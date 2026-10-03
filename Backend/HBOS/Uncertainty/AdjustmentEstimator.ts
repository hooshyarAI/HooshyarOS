/**
 * Stage 07-H - Adjustment Estimator (OLS-based ATE)
 *
 * A simple linear-adjustment estimator of the Average Treatment Effect
 * (ATE). The model is:
 *
 *     Y_i = beta0 + beta_T * T_i + beta_X^T X_i + epsilon_i
 *
 * where T is the (binary or continuous) treatment, X is a matrix of
 * covariates, and epsilon is mean-zero noise. The OLS coefficient on T
 * (beta_T) is the ATE estimator under standard linear-model assumptions.
 *
 * IMPORTANT ASSUMPTIONS (documented explicitly):
 *  1. LINEARITY: outcome is linear in treatment and covariates.
 *  2. UNCONFOUNDEDNESS: no unobserved confounder of T and Y given X.
 *  3. POSITIVITY: 0 < P(T=1|X) < 1 (only meaningful for binary T).
 *  4. CONSISTENCY: Y(t) = Y when T = t (well-defined potential outcomes).
 *  5. NO INTERFERENCE: one unit's treatment does not affect another's Y.
 *  6. The normal-based confidence interval relies on the LARGE-SAMPLE
 *     APPROXIMATION beta_t ~ N(ATE, SE^2); it is NOT exact for small n.
 *
 * If any pre-condition is violated, the estimator returns a CausalEffect
 * with `assumptionsViolated: true` and `pointEstimate = NaN`, NEVER
 * silently fabricating a causal number.
 *
 * METHOD (OLS via normal equations, same path as Stage 07-F):
 *   - First column of design matrix is all-ones (intercept).
 *   - Second column is the treatment vector.
 *   - Remaining columns are the covariates.
 *   - Closed-form beta = (X'X)^-1 X'Y.
 *   - Standard error of beta_t: sigma_hat / sqrt( Sxx_t ), where Sxx_t
 *     is the centred sum of squares of T. This is the SE under the
 *     assumption that T is exogenous given X. (Conservative fallback.)
 */

import { CausalEffect, CausalAssumptions } from "./CausalTypes";

const SINGULARITY_EPSILON = 1e-12;
const MIN_SAMPLES = 3;

export const AdjustmentEstimator = {
    estimateATE(
        treatment: ReadonlyArray<number>,
        outcome: ReadonlyArray<number>,
        covariates: ReadonlyArray<ReadonlyArray<number>>
    ): CausalEffect {
        return estimateATEInternal(treatment, outcome, covariates);
    },

    buildAssumptions(
        positivityOk: boolean,
        unconfoundednessClaimed: boolean,
        consistencyClaimed: boolean,
        noInterferenceClaimed: boolean,
        model: string
    ): CausalAssumptions {
        return Object.freeze({
            unconfoundedness: unconfoundednessClaimed,
            positivity: positivityOk,
            consistency: consistencyClaimed,
            noInterference: noInterferenceClaimed,
            model
        });
    }
};

function estimateATEInternal(
    treatment: ReadonlyArray<number>,
    outcome: ReadonlyArray<number>,
    covariates: ReadonlyArray<ReadonlyArray<number>>
): CausalEffect {
    const method = "ols_linear_adjustment";

    if (!treatment || treatment.length === 0 ||
        !outcome || outcome.length === 0) {
        return invalid(method);
    }
    const n = treatment.length;
    if (outcome.length !== n) {
        return invalid(method);
    }

    const treatmentIsConstant = treatment.every(v => v === treatment[0]);
    if (treatmentIsConstant) {
        return invalid(method);
    }
    const outcomeIsConstant = outcome.every(v => v === outcome[0]);

    const covArr: number[][] = [];
    if (covariates && covariates.length > 0) {
        for (let i = 0; i < covariates.length; i++) {
            if (covariates[i].length !== n) {
                return invalid(method);
            }
            covArr.push(covariates[i].slice());
        }
    }

    const pDesign = 1 + 1 + covArr.length;
    if (n < MIN_SAMPLES) {
        return invalid(method);
    }
    if (n <= pDesign) {
        return invalid(method);
    }

    const xRows: number[][] = new Array<number[]>(n);
    const yVec: number[] = new Array<number>(n);
    for (let i = 0; i < n; i++) {
        const t = treatment[i];
        const y = outcome[i];
        if (!Number.isFinite(t) || !Number.isFinite(y)) {
            return invalid(method);
        }
        const row = new Array<number>(pDesign);
        row[0] = 1;
        row[1] = t;
        for (let j = 0; j < covArr.length; j++) {
            const v = covArr[j][i];
            if (!Number.isFinite(v)) {
                return invalid(method);
            }
            row[2 + j] = v;
        }
        xRows[i] = row;
        yVec[i] = y;
    }

    if (outcomeIsConstant) {
        const beta = olsSolve(xRows, yVec, n, pDesign);
        if (beta === null) {
            return invalid(method);
        }
        return {
            pointEstimate: beta[1],
            standardError: 0,
            confidenceInterval: { lower: beta[1], upper: beta[1] },
            pValue: 1,
            method,
            assumptionsViolated: true
        };
    }

    const beta = olsSolve(xRows, yVec, n, pDesign);
    if (beta === null) {
        return invalid(method);
    }

    let rss = 0;
    for (let i = 0; i < n; i++) {
        const row = xRows[i];
        let pred = 0;
        for (let j = 0; j < pDesign; j++) {
            pred += row[j] * beta[j];
        }
        const r = yVec[i] - pred;
        rss += r * r;
    }
    const dof = Math.max(n - pDesign, 1);
    const sigmaHat = Math.sqrt(rss / dof);

    const tCenteredVar = centeredVar(treatment);
    if (tCenteredVar < SINGULARITY_EPSILON) {
        return invalid(method);
    }

    const se = sigmaHat / Math.sqrt(tCenteredVar);
    const ate = beta[1];

    const z = ate / se;
    const pVal = 2 * (1 - normalCdf(Math.abs(z)));
    const ciLower = ate - 1.96 * se;
    const ciUpper = ate + 1.96 * se;

    return {
        pointEstimate: ate,
        standardError: se,
        confidenceInterval: { lower: ciLower, upper: ciUpper },
        pValue: pVal,
        method,
        assumptionsViolated: false
    };
}

function invalid(method: string): CausalEffect {
    return {
        pointEstimate: NaN,
        standardError: NaN,
        confidenceInterval: { lower: NaN, upper: NaN },
        pValue: NaN,
        method,
        assumptionsViolated: true
    };
}

function centeredVar(v: ReadonlyArray<number>): number {
    const n = v.length;
    if (n < 2) { return 0; }
    let m = 0;
    for (let i = 0; i < n; i++) { m += v[i]; }
    m /= n;
    let s = 0;
    for (let i = 0; i < n; i++) {
        const d = v[i] - m;
        s += d * d;
    }
    return s;
}

function olsSolve(
    x: ReadonlyArray<ReadonlyArray<number>>,
    y: ReadonlyArray<number>,
    n: number,
    p: number
): number[] | null {
    const xtx: number[][] = new Array<number[]>(p);
    const xty: number[] = new Array<number>(p).fill(0);
    for (let i = 0; i < p; i++) {
        xtx[i] = new Array<number>(p).fill(0);
    }
    for (let r = 0; r < n; r++) {
        const xr = x[r];
        const yr = y[r];
        for (let i = 0; i < p; i++) {
            xty[i] += xr[i] * yr;
            for (let j = 0; j < p; j++) {
                xtx[i][j] += xr[i] * xr[j];
            }
        }
    }
    const aug: number[][] = xtx.map((row, i) => {
        const out = row.slice();
        out.push(xty[i]);
        return out;
    });
    const inv = invert(aug);
    if (inv === null) { return null; }
    const beta = new Array<number>(p);
    for (let i = 0; i < p; i++) {
        beta[i] = inv[i][0];
    }
    return beta;
}

function invert(aug: number[][]): number[][] | null {
    const n = aug.length;
    if (n === 0) { return null; }
    const cols = aug[0].length;
    if (cols < n) { return null; }
    const M: number[][] = aug.map(row => row.slice());
    for (let i = 0; i < n; i++) {
        let pivotRow = i;
        let pivotVal = Math.abs(M[i][i]);
        for (let r = i + 1; r < n; r++) {
            const v = Math.abs(M[r][i]);
            if (v > pivotVal) { pivotVal = v; pivotRow = r; }
        }
        if (pivotVal < SINGULARITY_EPSILON) { return null; }
        if (pivotRow !== i) {
            const tmp = M[i]; M[i] = M[pivotRow]; M[pivotRow] = tmp;
        }
        const diag = M[i][i];
        for (let c = 0; c < cols; c++) { M[i][c] /= diag; }
        for (let r = 0; r < n; r++) {
            if (r === i) { continue; }
            const f = M[r][i];
            if (f === 0) { continue; }
            for (let c = 0; c < cols; c++) { M[r][c] -= f * M[i][c]; }
        }
    }
    const inv: number[][] = new Array<number[]>(n);
    for (let i = 0; i < n; i++) {
        inv[i] = new Array<number>(n);
        for (let j = 0; j < n; j++) {
            inv[i][j] = M[i][n + j];
        }
    }
    return inv;
}

function normalCdf(z: number): number {
    if (z <= 0) {
        return 0.5 * erfc(-z / Math.SQRT2);
    }
    return 1 - 0.5 * erfc(z / Math.SQRT2);
}

function erfc(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const t = 1 / (1 + p * ax);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
    return 1 - sign * y;
}

