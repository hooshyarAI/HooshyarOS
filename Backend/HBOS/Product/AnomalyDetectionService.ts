/**
 * Phase 09-2.6: Anomaly Detection (product service).
 *
 * Provides z-score, IQR, and modified z-score (median-based) detectors.
 * All deterministic. No new Engine.
 */

export interface AnomalyPoint {
    step: number;
    value: number;
    score: number;
    flag: "NORMAL" | "WARN" | "ALERT";
}

export interface AnomalyResult {
    method: "zscore" | "iqr" | "modifiedZ";
    n: number;
    mean?: number;
    stdDev?: number;
    median?: number;
    mad?: number;
    points: AnomalyPoint[];
    status: "READY" | "BLOCKED";
}

export class AnomalyDetectionService {
    private validate(series: readonly number[]): boolean {
        if (!Array.isArray(series) || series.length < 2) return false;
        for (const v of series) if (!Number.isFinite(v)) return false;
        return true;
    }

    zscore(series: readonly number[], warnZ = 2, alertZ = 3): AnomalyResult {
        if (!this.validate(series)) {
            return { method: "zscore", n: 0, points: [], status: "BLOCKED" };
        }
        const n = series.length;
        const mean = series.reduce((a, b) => a + b, 0) / n;
        const variance = series.reduce((s, v) => s + (v - mean) * (v - mean), 0) / n;
        const stdDev = Math.sqrt(variance);
        const points = series.map((v, i) => {
            const score = stdDev === 0 ? 0 : (v - mean) / stdDev;
            const flag: "NORMAL" | "WARN" | "ALERT" = Math.abs(score) >= alertZ ? "ALERT" : Math.abs(score) >= warnZ ? "WARN" : "NORMAL";
            return { step: i + 1, value: v, score, flag };
        });
        return { method: "zscore", n, mean, stdDev, points, status: "READY" };
    }

    iqr(series: readonly number[], k = 1.5): AnomalyResult {
        if (!this.validate(series)) {
            return { method: "iqr", n: 0, points: [], status: "BLOCKED" };
        }
        if (!Number.isFinite(k) || k < 0) {
            return { method: "iqr", n: series.length, points: [], status: "BLOCKED" };
        }
        const sorted = [...series].sort((a, b) => a - b);
        const q = (p: number) => {
            const idx = (sorted.length - 1) * p;
            const lo = Math.floor(idx), hi = Math.ceil(idx);
            if (lo === hi) return sorted[lo];
            return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
        };
        const q1 = q(0.25);
        const q3 = q(0.75);
        const iqr = q3 - q1;
        const lo = q1 - k * iqr;
        const hi = q3 + k * iqr;
        const points = series.map((v, i) => {
            const dist = v < lo ? lo - v : v > hi ? v - hi : 0;
            const score = iqr === 0 ? 0 : dist / iqr;
            const flag: "NORMAL" | "WARN" | "ALERT" = v < lo || v > hi ? "ALERT" : "NORMAL";
            return { step: i + 1, value: v, score, flag };
        });
        return { method: "iqr", n: series.length, median: q(0.5), points, status: "READY" };
    }

    modifiedZ(series: readonly number[], warnC = 3.5, alertC = 5): AnomalyResult {
        if (!this.validate(series)) {
            return { method: "modifiedZ", n: 0, points: [], status: "BLOCKED" };
        }
        const sorted = [...series].sort((a, b) => a - b);
        const n = sorted.length;
        const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[(n - 1) / 2];
        const absDev = series.map(v => Math.abs(v - median)).sort((a, b) => a - b);
        const mad = n % 2 === 0 ? (absDev[n / 2 - 1] + absDev[n / 2]) / 2 : absDev[(n - 1) / 2];
        const points = series.map((v, i) => {
            const score = mad === 0 ? 0 : 0.6745 * (v - median) / mad;
            const flag: "NORMAL" | "WARN" | "ALERT" = Math.abs(score) >= alertC ? "ALERT" : Math.abs(score) >= warnC ? "WARN" : "NORMAL";
            return { step: i + 1, value: v, score, flag };
        });
        return { method: "modifiedZ", n, median, mad, points, status: "READY" };
    }
}
