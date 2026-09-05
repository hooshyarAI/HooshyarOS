/**
 * Stage 07-H - Confounding Detector
 *
 * Simplified detection of potential confounders. A confounder here is
 * any candidate variable that correlates with BOTH the treatment and
 * the outcome in the observed data.
 *
 * IMPORTANT CAVEAT (documented explicitly):
 *  - Correlation between a candidate, the treatment, and the outcome
 *    is a HINT, not proof of confounding. Correlation is not causation.
 *  - This detector surfaces SUSPECT variables for the analyst to
 *    review; it does NOT claim causality.
 *  - High correlation can also arise from colliders or mediators; the
 *    human analyst must interpret the result.
 *  - The detector never infers causality from correlation.
 *
 * METHOD:
 *  - Compute Pearson correlation between every candidate and the
 *    treatment, and between every candidate and the outcome.
 *  - If |corr(c, T)| > threshold AND |corr(c, Y)| > threshold, flag.
 *  - Default thresholds: 0.3 for both, as specified in the task.
 *  - Edge cases: empty inputs, single-column candidates, NaNs.
 */

const CONF_CORR_THRESHOLD = 0.3;

export const ConfoundingDetector = {
    detectConfounding(
        treatment: ReadonlyArray<number>,
        outcome: ReadonlyArray<number>,
        candidates: ReadonlyArray<ReadonlyArray<number>>
    ): { suspectConfounders: number[]; reason: string } {
        if (!treatment || treatment.length === 0 ||
            !outcome || outcome.length === 0) {
            return {
                suspectConfounders: [],
                reason: "insufficient_data: empty treatment or outcome"
            };
        }
        if (treatment.length !== outcome.length) {
            return {
                suspectConfounders: [],
                reason: "invalid_request: treatment and outcome length mismatch"
            };
        }
        if (!candidates || candidates.length === 0) {
            return {
                suspectConfounders: [],
                reason: "no candidate covariates provided; nothing to flag"
            };
        }

        const n = treatment.length;
        if (n < 3) {
            return {
                suspectConfounders: [],
                reason: "insufficient_data: n < 3; correlation undefined"
            };
        }

        const suspect: number[] = [];
        const reasons: string[] = [];

        for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i];
            if (!c || c.length !== n) {
                continue;
            }
            if (!isFiniteVector(c)) {
                continue;
            }
            const corrT = pearson(c, treatment);
            const corrY = pearson(c, outcome);
            if (!Number.isFinite(corrT) || !Number.isFinite(corrY)) {
                continue;
            }
            if (Math.abs(corrT) > CONF_CORR_THRESHOLD &&
                Math.abs(corrY) > CONF_CORR_THRESHOLD) {
                suspect.push(i);
                reasons.push(
                    `candidate[${i}] correlates with treatment (r=${corrT.toFixed(3)}) ` +
                    `and outcome (r=${corrY.toFixed(3)})`
                );
            }
        }

        if (suspect.length === 0) {
            return {
                suspectConfounders: [],
                reason: `no candidate exceeded |r|>${CONF_CORR_THRESHOLD} with both treatment and outcome`
            };
        }

        return {
            suspectConfounders: suspect,
            reason:
                "FLAGGED ONLY: " + reasons.join("; ") +
                ". NOTE: correlation is not causation; flagged variables require analyst review."
        };
    }
};

function pearson(x: ReadonlyArray<number>, y: ReadonlyArray<number>): number {
    const n = x.length;
    if (n !== y.length || n < 2) {
        return NaN;
    }
    let mx = 0, my = 0;
    for (let i = 0; i < n; i++) {
        mx += x[i];
        my += y[i];
    }
    mx /= n;
    my /= n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
        const dx = x[i] - mx;
        const dy = y[i] - my;
        sxy += dx * dy;
        sxx += dx * dx;
        syy += dy * dy;
    }
    if (sxx === 0 || syy === 0) {
        return NaN;
    }
    return sxy / Math.sqrt(sxx * syy);
}

function isFiniteVector(v: ReadonlyArray<number>): boolean {
    for (let i = 0; i < v.length; i++) {
        if (!Number.isFinite(v[i])) { return false; }
    }
    return true;
}
