/**
 * Phase 09-1.14: KPI Intelligence Service (product service).
 *
 * Computes trend (slope + direction) and deviation (z-score, mean absolute
 * deviation) over a time series of KPI observations. Composes the
 * ExecutiveIntelligenceEngine primitives (KPI achievement rate) with linear
 * regression. No new Engine.
 */

export interface KpiTrend {
    method: "linearTrend";
    n: number;
    slope: number;
    intercept: number;
    direction: "UP" | "DOWN" | "FLAT";
    status: "READY" | "BLOCKED";
}

export interface KpiDeviation {
    method: "deviation";
    n: number;
    mean: number;
    stdDev: number;
    meanAbsoluteDeviation: number;
    zScores: number[];
    /** Per-step standard-deviation-from-mean classification. */
    anomalies: { step: number; value: number; zScore: number; flag: "NORMAL" | "WARN" | "ALERT" }[];
    status: "READY" | "BLOCKED";
}

export class KpiIntelligenceService {
    trend(series: readonly number[]): KpiTrend {
        if (!Array.isArray(series) || series.length < 2) {
            return { method: "linearTrend", n: 0, slope: 0, intercept: 0, direction: "FLAT", status: "BLOCKED" };
        }
        for (const v of series) {
            if (!Number.isFinite(v)) {
                return { method: "linearTrend", n: series.length, slope: 0, intercept: 0, direction: "FLAT", status: "BLOCKED" };
            }
        }
        const n = series.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i += 1) {
            const x = i + 1;
            const y = series[i];
            sumX += x; sumY += y; sumXY += x * y; sumXX += x * x;
        }
        const denom = n * sumXX - sumX * sumX;
        if (denom === 0) {
            return { method: "linearTrend", n, slope: 0, intercept: sumY / n, direction: "FLAT", status: "BLOCKED" };
        }
        const slope = (n * sumXY - sumX * sumY) / denom;
        const intercept = (sumY - slope * sumX) / n;
        const direction: "UP" | "DOWN" | "FLAT" = slope > 1e-9 ? "UP" : slope < -1e-9 ? "DOWN" : "FLAT";
        return { method: "linearTrend", n, slope, intercept, direction, status: "READY" };
    }

    deviation(series: readonly number[], warnZ = 1.5, alertZ = 2.0): KpiDeviation {
        if (!Array.isArray(series) || series.length < 2) {
            return { method: "deviation", n: 0, mean: 0, stdDev: 0, meanAbsoluteDeviation: 0, zScores: [], anomalies: [], status: "BLOCKED" };
        }
        for (const v of series) {
            if (!Number.isFinite(v)) {
                return { method: "deviation", n: series.length, mean: 0, stdDev: 0, meanAbsoluteDeviation: 0, zScores: [], anomalies: [], status: "BLOCKED" };
            }
        }
        const n = series.length;
        const mean = series.reduce((a, b) => a + b, 0) / n;
        const variance = series.reduce((s, v) => s + (v - mean) * (v - mean), 0) / n;
        const stdDev = Math.sqrt(variance);
        const mad = series.reduce((s, v) => s + Math.abs(v - mean), 0) / n;
        const zScores = series.map(v => stdDev === 0 ? 0 : (v - mean) / stdDev);
        const anomalies = series.map((v, i) => {
            const z = zScores[i];
            const flag: "NORMAL" | "WARN" | "ALERT" = Math.abs(z) >= alertZ ? "ALERT" : Math.abs(z) >= warnZ ? "WARN" : "NORMAL";
            return { step: i + 1, value: v, zScore: z, flag };
        });
        return { method: "deviation", n, mean, stdDev, meanAbsoluteDeviation: mad, zScores, anomalies, status: "READY" };
    }
}
