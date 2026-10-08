/**
 * Stage 07-E - SeededRNG
 *
 * Deterministic pseudo-random number generator for reproducible
 * Monte Carlo simulation. No calls to Math.random, no unseeded state,
 * no external provider dependency.
 *
 * ALGORITHM CHOICE: Mulberry32 (Tommy Ettinger / public domain)
 * - 32-bit state, very fast, deterministic across all JS engines.
 *
 * NORMAL SAMPLES: Box-Muller transform (standard form). One sample
 * per call; the second uniform-derived value is discarded.
 *
 * IMPORTANT:
 * - Same seed produces identical stream on every call
 * - No global state; every create() returns an independent generator
 * - Invalid seeds (NaN, Infinity, -Infinity, non-integers) throw.
 */

export interface SeededRNG {
    next(): number;
    nextInt(min: number, max: number): number;
    nextFloat(min: number, max: number): number;
    nextNormal(mean: number, std: number): number;
    readonly seed: number;
}

export function SeededRNG_create(seed: number): SeededRNG {
    if (!isValidSeed(seed)) {
        throw new Error(
            `SeededRNG: invalid seed ${String(seed)}. ` +
            `Seed must be a finite integer (got type ${typeof seed}).`
        );
    }
    const normalizedSeed = seed >>> 0;
    let state = normalizedSeed;

    function next(): number {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    function nextInt(min: number, max: number): number {
        if (!isFinite(min) || !isFinite(max)) {
            throw new Error(`SeededRNG.nextInt: bounds must be finite (got min=${min}, max=${max})`);
        }
        if (!Number.isInteger(min) || !Number.isInteger(max)) {
            throw new Error(`SeededRNG.nextInt: bounds must be integers (got min=${min}, max=${max})`);
        }
        if (max < min) {
            throw new Error(`SeededRNG.nextInt: max (${max}) must be >= min (${min})`);
        }
        const range = max - min + 1;
        return min + Math.floor(next() * range);
    }

    function nextFloat(min: number, max: number): number {
        if (!isFinite(min) || !isFinite(max)) {
            throw new Error(`SeededRNG.nextFloat: bounds must be finite (got min=${min}, max=${max})`);
        }
        if (max < min) {
            throw new Error(`SeededRNG.nextFloat: max (${max}) must be >= min (${min})`);
        }
        return min + next() * (max - min);
    }

    function nextNormal(mean: number, std: number): number {
        if (!isFinite(mean) || !isFinite(std)) {
            throw new Error(`SeededRNG.nextNormal: mean and std must be finite (got mean=${mean}, std=${std})`);
        }
        if (std < 0) {
            throw new Error(`SeededRNG.nextNormal: std must be >= 0 (got std=${std})`);
        }
        let u1 = next();
        if (u1 <= 0) {
            u1 = 1e-12;
        }
        const u2 = next();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        return mean + z0 * std;
    }

    return Object.freeze({
        next,
        nextInt,
        nextFloat,
        nextNormal,
        seed: normalizedSeed
    });
}

function isValidSeed(seed: number): boolean {
    return (
        typeof seed === "number" &&
        Number.isFinite(seed) &&
        Number.isInteger(seed)
    );
}
