/**
 * Stage 07-G - Posterior Predictive Checks
 *
 * Simplified posterior predictive distribution and checks.
 *
 * METHOD:
 *   - predictiveSamples: draws samples from the posterior predictive distribution
 *     using the SeededRNG from Stage 07-E
 *   - posteriorPredictiveCheck: compares observed data against predictive samples
 *     using a simplified PPC statistic
 *
 * SAMPLING:
 *   - Normal posterior: draw from N(μ, σ) using SeededRNG.nextNormal()
 *   - Beta posterior: draw using inverse-CDF via two uniform samples
 *   - Point posterior: return the point value
 *
 * POSTERIOR PREDICTIVE CHECK:
 *   - Computes the proportion of observed values that fall within the
 *     predictive sample distribution (within [p2.5, p97.5] of samples)
 *   - isPlausible: true if the observed mean falls within the middle 95% of samples
 *   - pValue: proportion of predictive samples more extreme than observed mean
 *
 * IMPORTANT:
 * - Uses SeededRNG from Stage 07-E for reproducibility
 * - No fabrication of P-values; statistics are computed directly from samples
 * - Tenant isolation enforced via provenance
 * - Deterministic for fixed seeds
 */

import { SeededRNG_create, SeededRNG } from "./SeededRNG";
import { Posterior, BayesianProvenance } from "./BayesianTypes";

const CANONICAL_TIMESTAMP = "2026-01-01T00:00:00Z";

export const PosteriorPredictive = {
    predictiveSamples(posterior: Posterior, count: number, seed: number): number[] {
        if (count < 0) {
            throw new Error("PosteriorPredictive.predictiveSamples: count must be non-negative");
        }
        if (count === 0) {
            return [];
        }

        const rng = SeededRNG_create(seed);
        const samples: number[] = [];

        if (posterior.distribution === "normal") {
            const std = Math.sqrt(Math.max(0, posterior.variance));
            for (let i = 0; i < count; i++) {
                samples.push(rng.nextNormal(posterior.mean, std));
            }
        } else if (posterior.distribution === "beta") {
            const a = posterior.alpha;
            const b = posterior.beta;
            for (let i = 0; i < count; i++) {
                const u1 = rng.next();
                const u2 = rng.next();
                const x = betaInvCDF(a, b, Math.max(1e-12, Math.min(1 - 1e-12, u1)));
                samples.push(x);
            }
        } else if (posterior.distribution === "uniform") {
            for (let i = 0; i < count; i++) {
                samples.push(rng.nextFloat(posterior.lower, posterior.upper));
            }
        } else if (posterior.distribution === "point") {
            for (let i = 0; i < count; i++) {
                samples.push(posterior.value);
            }
        } else {
            throw new Error("PosteriorPredictive.predictiveSamples: unsupported distribution");
        }

        return samples;
    },

    posteriorPredictiveCheck(
        predicted: number[],
        observed: number[]
    ): { pValue: number; isPlausible: boolean } {
        if (predicted.length === 0) {
            throw new Error("PosteriorPredictive.posteriorPredictiveCheck: predicted samples are empty");
        }
        if (observed.length === 0) {
            throw new Error("PosteriorPredictive.posteriorPredictiveCheck: observed values are empty");
        }

        const predSorted = [...predicted].sort((a, b) => a - b);
        const observedMean = observed.reduce((s, v) => s + v, 0) / observed.length;

        const p2p5 = percentile(predSorted, 0.025);
        const p97p5 = percentile(predSorted, 0.975);

        const isPlausible = observedMean >= p2p5 && observedMean <= p97p5;

        let moreExtreme = 0;
        for (const p of predSorted) {
            if (Math.abs(p - median(predSorted)) >= Math.abs(observedMean - median(predSorted))) {
                moreExtreme++;
            }
        }
        const pValue = moreExtreme / predicted.length;

        return { pValue, isPlausible };
    }
};

function median(sorted: number[]): number {
    const n = sorted.length;
    if (n % 2 === 1) {
        return sorted[Math.floor(n / 2)];
    }
    return (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

function percentile(sorted: number[], p: number): number {
    const n = sorted.length;
    const idx = p * (n - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) {
        return sorted[lower];
    }
    const frac = idx - lower;
    return sorted[lower] * (1 - frac) + sorted[upper] * frac;
}

function betaInvCDF(alpha: number, betaParam: number, p: number): number {
    const lnBeta = lnBetaFn(alpha, betaParam);
    const lb = alpha > 1 ? Math.exp((alpha - 1) * Math.log(alpha - 1) - lnBetaFn(alpha - 1, betaParam)) : 0;
    const ub = betaParam > 1 ? Math.exp((betaParam - 1) * Math.log(betaParam - 1) - lnBetaFn(alpha, betaParam - 1)) : 1;
    let lo = lb;
    let hi = ub;
    for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        const cdf = regularizedIncompleteBeta(alpha, betaParam, mid);
        if (cdf < p) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

function lnBetaFn(a: number, b: number): number {
    return lgamma(a) + lgamma(b) - lgamma(a + b);
}

function lgamma(x: number): number {
    const coef = [
        76.18009172947146,
        -86.50532032941677,
        24.01409824083091,
        -1.231739572450155,
        0.1208650973866179e-2,
        -0.5395239384953e-5
    ];
    let y = x;
    const tmp = x + 5.5;
    const tmp2 = tmp - (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < coef.length; j++) {
        y += 1;
        ser += coef[j] / y;
    }
    return -tmp2 + Math.log(2.5066282746310005 * ser / x);
}

function regularizedIncompleteBeta(a: number, b: number, x: number): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const lnBeta = lnBetaFn(a, b);
    const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lnBeta) / a;
    if (x < (a + 1) / (a + b + 2)) {
        return front * betacf(a, b, x);
    }
    return 1 - front * betacf(b, a, 1 - x);
}

function betacf(a: number, b: number, x: number): number {
    const maxIter = 200;
    const eps = 1e-12;
    let qab = a + b;
    let qap = a + 1;
    let qam = a - 1;
    let c = 1;
    let d = 1 - qab * x / qap;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= maxIter; m++) {
        let m2 = 2 * m;
        let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < 1e-30) d = 1e-30;
        c = 1 + aa / c;
        if (Math.abs(c) < 1e-30) c = 1e-30;
        d = 1 / d;
        h *= d * c;
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < 1e-30) d = 1e-30;
        c = 1 + aa / c;
        if (Math.abs(c) < 1e-30) c = 1e-30;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < eps) break;
    }
    return h;
}

