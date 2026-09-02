/**
 * Stage 07-A - Descriptive Statistics
 *
 * Deterministic statistical primitives for time-series analysis.
 *
 * IMPORTANT:
 * - These are DESCRIPTIVE statistics, not inferential
 * - All methods are reproducible: same input -> same output
 * - Statistical metadata is included for evidence
 * - No arbitrary confidence scores are generated
 *
 * Naming conventions to avoid confusion:
 * - "variance" in business logic = arithmetic difference (budget_variance = actual - planned)
 * - "sampleVariance" here = statistical variance with Bessel's correction
 */

import {
    MetricObservation,
    StatisticalSummary,
    StatisticalProvenance,
    StatisticalMethod
} from "./TemporalTypes";
import { ProvenanceTrace } from "../Core/ProvenanceTrace";

/**
 * DescriptiveStatistics - Canonical statistical primitives
 */
export const DescriptiveStatistics = {
    /**
     * Calculate arithmetic mean
     */
    mean(values: readonly number[]): number {
        if (!values || values.length === 0) {
            return NaN;
        }
        const sum = values.reduce((acc, v) => acc + v, 0);
        return sum / values.length;
    },

    /**
     * Calculate median using linear interpolation
     * Uses the "midpoint" convention: median is average of two middle values for even n
     */
    median(values: readonly number[]): number {
        if (!values || values.length === 0) {
            return NaN;
        }
        if (values.length === 1) {
            return values[0];
        }

        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);

        if (sorted.length % 2 === 0) {
            // Even: average of two middle values
            return (sorted[mid - 1] + sorted[mid]) / 2;
        } else {
            // Odd: middle value
            return sorted[mid];
        }
    },

    /**
     * Calculate sample variance with Bessel's correction (n-1)
     * Returns NaN if n < 2
     */
    sampleVariance(values: readonly number[]): number {
        if (!values || values.length < 2) {
            return NaN;
        }

        const n = values.length;
        const avg = DescriptiveStatistics.mean(values);
        const sumSquaredDiff = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0);
        return sumSquaredDiff / (n - 1);
    },

    /**
     * Calculate sample standard deviation (sqrt of sample variance)
     * Returns NaN if n < 2
     */
    sampleStandardDeviation(values: readonly number[]): number {
        const variance = DescriptiveStatistics.sampleVariance(values);
        if (Number.isNaN(variance)) {
            return NaN;
        }
        return Math.sqrt(variance);
    },

    /**
     * Calculate population variance (no Bessel's correction)
     * Returns NaN if n < 1
     */
    populationVariance(values: readonly number[]): number {
        if (!values || values.length < 1) {
            return NaN;
        }

        const n = values.length;
        const avg = DescriptiveStatistics.mean(values);
        const sumSquaredDiff = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0);
        return sumSquaredDiff / n;
    },

    /**
     * Calculate population standard deviation
     */
    populationStandardDeviation(values: readonly number[]): number {
        const variance = DescriptiveStatistics.populationVariance(values);
        if (Number.isNaN(variance)) {
            return NaN;
        }
        return Math.sqrt(variance);
    },

    /**
     * Calculate percentile using linear interpolation (Type 7 in Hyndman & Fan)
     * p should be between 0 and 1 (e.g., 0.5 for median)
     * Returns NaN if values array is empty
     */
    percentile(values: readonly number[], p: number): number {
        if (!values || values.length === 0 || p < 0 || p > 1) {
            return NaN;
        }
        if (values.length === 1) {
            return values[0];
        }
        if (p === 0) {
            return DescriptiveStatistics.min(values);
        }
        if (p === 1) {
            return DescriptiveStatistics.max(values);
        }

        const sorted = [...values].sort((a, b) => a - b);
        const rank = p * (sorted.length - 1);
        const lower = Math.floor(rank);
        const upper = Math.ceil(rank);
        const fraction = rank - lower;

        if (lower === upper) {
            return sorted[lower];
        }

        // Linear interpolation
        return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
    },

    /**
     * Calculate min value
     */
    min(values: readonly number[]): number {
        if (!values || values.length === 0) {
            return NaN;
        }
        return Math.min(...values);
    },

    /**
     * Calculate max value
     */
    max(values: readonly number[]): number {
        if (!values || values.length === 0) {
            return NaN;
        }
        return Math.max(...values);
    },

    /**
     * Calculate sum
     */
    sum(values: readonly number[]): number {
        if (!values || values.length === 0) {
            return 0;
        }
        return values.reduce((acc, v) => acc + v, 0);
    },

    /**
     * Calculate common percentiles at once
     */
    percentiles(values: readonly number[], ps: readonly number[] = [0.1, 0.25, 0.5, 0.75, 0.9]): Record<string, number> {
        const result: Record<string, number> = {};
        for (const p of ps) {
            const key = `p${Math.round(p * 100)}`;
            result[key] = DescriptiveStatistics.percentile(values, p);
        }
        return result;
    },

    /**
     * Create a statistical summary from observations
     */
    createSummary(
        observations: readonly MetricObservation[],
        startTime: string,
        endTime: string,
        methodDescription: string = "Stage 07-A DescriptiveStatistics"
    ): StatisticalSummary | null {
        if (!observations || observations.length === 0) {
            return null;
        }

        const tenantId = observations[0].tenantId;
        const metricName = observations[0].metricName;
        const values = observations.map(o => o.value);

        const sum = DescriptiveStatistics.sum(values);
        const mean = DescriptiveStatistics.mean(values);
        const median = DescriptiveStatistics.median(values);
        const sampleVar = DescriptiveStatistics.sampleVariance(values);
        const sampleStd = DescriptiveStatistics.sampleStandardDeviation(values);
        const min = DescriptiveStatistics.min(values);
        const max = DescriptiveStatistics.max(values);

        const percentileResults = DescriptiveStatistics.percentiles(values, [0.1, 0.25, 0.5, 0.75, 0.9]);

        const inputRef = ProvenanceTrace.hashInput(
            `${tenantId}:${metricName}:${observations.length}obs:${startTime}-${endTime}`
        );

        const provenance: StatisticalProvenance = {
            traceId: ProvenanceTrace.createTraceId(),
            inputRef,
            method: methodDescription,
            timestamp: new Date().toISOString()
        };

        return {
            tenantId,
            metricName,
            startTime,
            endTime,
            observationCount: observations.length,
            min,
            max,
            sum: Math.round(sum * 1000000) / 1000000,
            mean: Math.round(mean * 1000000) / 1000000,
            median: Math.round(median * 1000000) / 1000000,
            sampleVariance: Number.isNaN(sampleVar) ? 0 : Math.round(sampleVar * 1000000) / 1000000,
            sampleStandardDeviation: Number.isNaN(sampleStd) ? 0 : Math.round(sampleStd * 1000000) / 1000000,
            percentiles: {
                p10: percentileResults.p10,
                p25: percentileResults.p25,
                p50: percentileResults.p50,
                p75: percentileResults.p75,
                p90: percentileResults.p90
            },
            method: {
                mean: StatisticalMethod.MEAN,
                median: StatisticalMethod.MEDIAN,
                variance: "sample",
                percentiles: StatisticalMethod.PERCENTILE
            },
            provenance
        };
    },

    /**
     * Verify statistical summary against original values
     * Returns verification result with actual values for comparison
     */
    verifySummary(summary: StatisticalSummary, observations: readonly MetricObservation[]): {
        verified: boolean;
        errors: string[];
        actualValues: {
            mean: number;
            median: number;
            sampleStd: number;
        };
    } {
        const errors: string[] = [];
        const values = observations.map(o => o.value);

        const actualMean = DescriptiveStatistics.mean(values);
        const actualMedian = DescriptiveStatistics.median(values);
        const actualStd = DescriptiveStatistics.sampleStandardDeviation(values);

        // Use relative tolerance of 1e-6 for floating point comparison
        const tolerance = 1e-6;

        if (Math.abs(actualMean - summary.mean) > tolerance) {
            errors.push(`Mean mismatch: expected ${actualMean}, got ${summary.mean}`);
        }
        if (Math.abs(actualMedian - summary.median) > tolerance) {
            errors.push(`Median mismatch: expected ${actualMedian}, got ${summary.median}`);
        }
        if (Math.abs(actualStd - summary.sampleStandardDeviation) > tolerance) {
            errors.push(`Std mismatch: expected ${actualStd}, got ${summary.sampleStandardDeviation}`);
        }

        return {
            verified: errors.length === 0,
            errors,
            actualValues: {
                mean: Math.round(actualMean * 1000000) / 1000000,
                median: Math.round(actualMedian * 1000000) / 1000000,
                sampleStd: Math.round(actualStd * 1000000) / 1000000
            }
        };
    }
};
