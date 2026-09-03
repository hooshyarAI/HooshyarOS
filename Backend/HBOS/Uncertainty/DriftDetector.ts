/**
 * Stage 07-J - DriftDetector
 *
 * Detects metric and distribution drift between baseline and current values.
 *
 * METHODS:
 * - detectMetricDrift: compare two scalar metrics with a threshold.
 * - detectDistributionDrift: compare means of two distributions; drift if
 *   |mean_diff| > threshold * max(std_baseline, 0.01).
 *
 * IMPORTANT:
 * - Reuses canonical Stage 07-A DescriptiveStatistics for mean/std.
 * - All outputs are immutable (Object.freeze).
 * - Deterministic: identical inputs produce identical outputs.
 * - No fabricated confidence.
 */

import { DescriptiveStatistics } from "../Temporal/DescriptiveStatistics";
import { DriftIndicator } from "./EvaluationTypes";

const CANONICAL_TIMESTAMP = "2026-01-01T00:00:00Z";

export const DriftDetector = {
    detectMetricDrift(
        baselineValue: number,
        currentValue: number,
        threshold: number,
        metricName: string
    ): DriftIndicator {
        const driftScore = Math.abs(currentValue - baselineValue);
        const isDrift = driftScore > threshold;
        return Object.freeze({
            metric: metricName,
            baselineValue,
            currentValue,
            driftScore,
            threshold,
            isDrift
        });
    },

    detectDistributionDrift(
        baseline: number[],
        current: number[],
        threshold: number,
        metricName: string
    ): DriftIndicator {
        const baselineMean = DescriptiveStatistics.mean(baseline.filter(v => Number.isFinite(v)));
        const currentMean = DescriptiveStatistics.mean(current.filter(v => Number.isFinite(v)));
        const baselineStd = DescriptiveStatistics.sampleStandardDeviation(baseline.filter(v => Number.isFinite(v)));
        const safeStd = Number.isNaN(baselineStd) ? 0 : baselineStd;
        const scale = Math.max(safeStd, 0.01);
        const meanDiff = Math.abs(currentMean - baselineMean);
        const driftScore = meanDiff / scale;
        const isDrift = meanDiff > threshold * scale;
        return Object.freeze({
            metric: metricName,
            baselineValue: Number.isNaN(baselineMean) ? 0 : baselineMean,
            currentValue: Number.isNaN(currentMean) ? 0 : currentMean,
            driftScore,
            threshold,
            isDrift
        });
    }
};
