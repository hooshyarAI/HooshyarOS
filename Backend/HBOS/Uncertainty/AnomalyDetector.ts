/**
 * Stage 07-F - Anomaly Detector
 *
 * Robust anomaly detection using:
 *   1. MAD  - Median Absolute Deviation
 *   2. ZSCORE - standard score (mean / sample standard deviation)
 *
 * METHOD (MAD):
 *   median = median(x)
 *   mad    = median(|x_i - median|)
 *   If mad == 0 (constant signal), flag nothing.
 *   modified_z_i = 0.6745 * (x_i - median) / mad
 *   If |modified_z_i| > threshold (default 3.5), flag as anomaly.
 *
 * The 0.6745 constant makes MAD a consistent estimator of the
 * standard deviation under a normal assumption; threshold 3.5
 * corresponds to ~99.95% confidence.
 *
 * METHOD (ZSCORE):
 *   z_i = (x_i - mean) / sample_std
 *   If |z_i| > threshold, flag as anomaly.
 *
 * IMPORTANT:
 * - Deterministic; identical inputs produce identical scores.
 * - Reuses canonical Stage 07-A DescriptiveStatistics for mean/median.
 * - No external dependencies; pure TypeScript.
 * - Small-sample guard: n < 5 returns "not_anomaly" for every point.
 * - Constant / near-constant series: no anomalies (no fabricated thresholds).
 */

import { DescriptiveStatistics } from "../Temporal/DescriptiveStatistics";
import { AnomalyScore } from "./MLTypes";

export const DEFAULT_MAD_THRESHOLD = 3.5;
export const DEFAULT_ZSCORE_THRESHOLD = 3.0;
const MIN_SAMPLES_FOR_DETECTION = 5;
const MAD_CONSISTENCY_CONSTANT = 0.6745;

export interface AnomalyContext {
    readonly median: number;
    readonly mad: number;
    readonly threshold: number;
}

export const AnomalyDetector = {
    detectAnomalies(values: ReadonlyArray<number>, threshold: number = DEFAULT_MAD_THRESHOLD): ReadonlyArray<AnomalyScore> {
        const scores: AnomalyScore[] = [];
        const n = values.length;

        if (n < MIN_SAMPLES_FOR_DETECTION) {
            for (let i = 0; i < n; i++) {
                scores.push(Object.freeze({
                    index: i, value: values[i], score: 0, threshold,
                    isAnomaly: false,
                    reason: `insufficient_data: n=${n} < ${MIN_SAMPLES_FOR_DETECTION}; cannot reliably estimate median and MAD`,
                    contributingFeatures: Object.freeze([])
                }));
            }
            return Object.freeze(scores);
        }

        const finite: number[] = [];
        for (const v of values) {
            if (Number.isFinite(v)) { finite.push(v); }
        }
        if (finite.length < MIN_SAMPLES_FOR_DETECTION) {
            for (let i = 0; i < n; i++) {
                scores.push(Object.freeze({
                    index: i, value: values[i], score: 0, threshold,
                    isAnomaly: false,
                    reason: `insufficient_data: finite values=${finite.length} < ${MIN_SAMPLES_FOR_DETECTION}`,
                    contributingFeatures: Object.freeze([])
                }));
            }
            return Object.freeze(scores);
        }

        const median = DescriptiveStatistics.median(finite);
        const absDev = finite.map(v => Math.abs(v - median));
        const mad = DescriptiveStatistics.median(absDev);

        for (let i = 0; i < n; i++) {
            const v = values[i];
            if (!Number.isFinite(v)) {
                scores.push(Object.freeze({
                    index: i, value: v, score: NaN, threshold,
                    isAnomaly: false,
                    reason: "non_finite_value",
                    contributingFeatures: Object.freeze([])
                }));
                continue;
            }
            if (mad === 0) {
                scores.push(Object.freeze({
                    index: i, value: v, score: 0, threshold,
                    isAnomaly: false,
                    reason: `constant_signal: MAD=0; cannot compute modified z-score (value=${v}, median=${median})`,
                    contributingFeatures: Object.freeze([])
                }));
                continue;
            }
            const modifiedZ = (MAD_CONSISTENCY_CONSTANT * (v - median)) / mad;
            const isAnomaly = Math.abs(modifiedZ) > threshold;
            const direction = modifiedZ > 0 ? "above" : "below";
            scores.push(Object.freeze({
                index: i, value: v, score: modifiedZ, threshold,
                isAnomaly,
                reason: isAnomaly
                    ? `modified_z=${formatNumber(modifiedZ)} exceeds threshold=${threshold} (value=${v} is ${direction} median=${median}, mad=${formatNumber(mad)})`
                    : `within_threshold: modified_z=${formatNumber(modifiedZ)} <= threshold=${threshold} (median=${median}, mad=${formatNumber(mad)})`,
                contributingFeatures: Object.freeze([])
            }));
        }
        return Object.freeze(scores);
    },

    detectZScoreAnomalies(values: ReadonlyArray<number>, threshold: number = DEFAULT_ZSCORE_THRESHOLD): ReadonlyArray<AnomalyScore> {
        const scores: AnomalyScore[] = [];
        const n = values.length;

        if (n < MIN_SAMPLES_FOR_DETECTION) {
            for (let i = 0; i < n; i++) {
                scores.push(Object.freeze({
                    index: i, value: values[i], score: 0, threshold,
                    isAnomaly: false,
                    reason: `insufficient_data: n=${n} < ${MIN_SAMPLES_FOR_DETECTION}`,
                    contributingFeatures: Object.freeze([])
                }));
            }
            return Object.freeze(scores);
        }

        const finite: number[] = [];
        for (const v of values) {
            if (Number.isFinite(v)) { finite.push(v); }
        }
        if (finite.length < MIN_SAMPLES_FOR_DETECTION) {
            for (let i = 0; i < n; i++) {
                scores.push(Object.freeze({
                    index: i, value: values[i], score: 0, threshold,
                    isAnomaly: false,
                    reason: `insufficient_data: finite values=${finite.length} < ${MIN_SAMPLES_FOR_DETECTION}`,
                    contributingFeatures: Object.freeze([])
                }));
            }
            return Object.freeze(scores);
        }

        const mean = DescriptiveStatistics.mean(finite);
        const std = DescriptiveStatistics.sampleStandardDeviation(finite);

        for (let i = 0; i < n; i++) {
            const v = values[i];
            if (!Number.isFinite(v)) {
                scores.push(Object.freeze({
                    index: i, value: v, score: NaN, threshold,
                    isAnomaly: false,
                    reason: "non_finite_value",
                    contributingFeatures: Object.freeze([])
                }));
                continue;
            }
            if (std === 0 || !Number.isFinite(std)) {
                scores.push(Object.freeze({
                    index: i, value: v, score: 0, threshold,
                    isAnomaly: false,
                    reason: `constant_signal: std=0; cannot compute z-score (value=${v}, mean=${mean})`,
                    contributingFeatures: Object.freeze([])
                }));
                continue;
            }
            const z = (v - mean) / std;
            const isAnomaly = Math.abs(z) > threshold;
            const direction = z > 0 ? "above" : "below";
            scores.push(Object.freeze({
                index: i, value: v, score: z, threshold,
                isAnomaly,
                reason: isAnomaly
                    ? `z_score=${formatNumber(z)} exceeds threshold=${threshold} (value=${v} is ${direction} mean=${mean}, std=${formatNumber(std)})`
                    : `within_threshold: z_score=${formatNumber(z)} <= threshold=${threshold} (mean=${mean}, std=${formatNumber(std)})`,
                contributingFeatures: Object.freeze([])
            }));
        }
        return Object.freeze(scores);
    },

    explainAnomaly(score: AnomalyScore, context: AnomalyContext): string {
        if (!score.isAnomaly) {
            return `Observation at index=${score.index} (value=${score.value}) is not anomalous under the supplied context (threshold=${context.threshold}, median=${context.median}, mad=${context.mad}).`;
        }
        return `Observation at index=${score.index} (value=${score.value}) is anomalous: score=${formatNumber(score.score)} exceeds threshold=${context.threshold} (median=${context.median}, mad=${formatNumber(context.mad)}).`;
    }
};

function formatNumber(n: number): string {
    if (!Number.isFinite(n)) { return "NaN"; }
    return (Math.round(n * 1e6) / 1e6).toString();
}
