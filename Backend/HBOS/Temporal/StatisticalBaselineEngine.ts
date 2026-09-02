/**
 * Stage 07-B - Statistical Baseline Engine
 *
 * Canonical statistical baseline creation using Stage 07-A primitives.
 *
 * IMPORTANT:
 * - Reuses DescriptiveStatistics from Stage 07-A
 * - No duplicate mathematical implementations
 * - Deterministic results
 * - Explicit insufficient-data states
 */

import { MetricObservation, StatisticalSummary } from "./TemporalTypes";
import { DescriptiveStatistics } from "./DescriptiveStatistics";
import {
    StatisticalBaseline,
    BaselineProvenance,
    CreateBaselineInput
} from "./BaselineTypes";

/**
 * StatisticalBaselineEngine - Canonical baseline creation
 */
export const StatisticalBaselineEngine = {
    /**
     * Create a statistical baseline from observations
     *
     * @param input - observations and metadata
     * @returns StatisticalBaseline or null if insufficient data
     */
    createBaseline(input: CreateBaselineInput): StatisticalBaseline | null {
        const { observations, source, minObservations = 2 } = input;

        if (!observations || observations.length < minObservations) {
            return null;
        }

        const values = observations.map(o => o.value);

        // Check for non-finite values
        if (!values.every(v => Number.isFinite(v))) {
            return null;
        }

        const tenantId = observations[0].tenantId;
        const metricName = observations[0].metricName;

        // Get time window from observations
        const sorted = [...observations].sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        const timeWindow = {
            start: sorted[0].timestamp,
            end: sorted[sorted.length - 1].timestamp
        };

        // Calculate statistics using Stage 07-A primitives
        const mean = DescriptiveStatistics.mean(values);
        const median = DescriptiveStatistics.median(values);
        const sampleVariance = DescriptiveStatistics.sampleVariance(values);
        const sampleStd = DescriptiveStatistics.sampleStandardDeviation(values);
        const min = DescriptiveStatistics.min(values);
        const max = DescriptiveStatistics.max(values);

        // Calculate percentiles
        const percentiles = DescriptiveStatistics.percentiles(values, [0.1, 0.25, 0.5, 0.75, 0.9]);

        // Build provenance
        const provenance: BaselineProvenance = {
            source,
            metric: metricName,
            tenant: tenantId,
            timeWindow: {
                start: timeWindow.start,
                end: timeWindow.end
            },
            observationCount: observations.length,
            statisticalConvention: {
                mean: "arithmetic",
                variance: "sample_n-1",
                percentile: "type7"
            }
        };

        return Object.freeze({
            tenantId,
            metricName,
            timeWindow: Object.freeze({ ...timeWindow }),
            observationCount: observations.length,
            mean,
            median,
            sampleVariance: Number.isNaN(sampleVariance) ? 0 : sampleVariance,
            sampleStandardDeviation: Number.isNaN(sampleStd) ? 0 : sampleStd,
            min,
            max,
            percentiles: Object.freeze({
                p10: percentiles.p10,
                p25: percentiles.p25,
                p50: percentiles.p50,
                p75: percentiles.p75,
                p90: percentiles.p90
            }),
            statisticalConvention: Object.freeze({
                mean: "arithmetic",
                variance: "sample_n-1",
                percentile: "type7"
            }),
            provenance: Object.freeze(provenance)
        });
    },

    /**
     * Get baseline metadata
     */
    getMetadata(): {
        version: string;
        statisticalConventions: {
            mean: string;
            variance: string;
            percentile: string;
        };
    } {
        return {
            version: "07-B",
            statisticalConventions: {
                mean: "arithmetic mean (sum/n)",
                variance: "sample variance with Bessel's correction (n-1)",
                percentile: "Type 7 (Hyndman & Fan) linear interpolation"
            }
        };
    },

    /**
     * Verify baseline against original observations
     */
    verifyBaseline(
        baseline: StatisticalBaseline,
        observations: readonly MetricObservation[]
    ): {
        verified: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (observations.length !== baseline.observationCount) {
            errors.push(`Observation count mismatch: expected ${baseline.observationCount}, got ${observations.length}`);
        }

        const values = observations.map(o => o.value);
        const expectedMean = DescriptiveStatistics.mean(values);
        const expectedMedian = DescriptiveStatistics.median(values);
        const expectedStd = DescriptiveStatistics.sampleStandardDeviation(values);

        const tolerance = 1e-6;

        if (Math.abs(expectedMean - baseline.mean) > tolerance) {
            errors.push(`Mean mismatch: expected ${expectedMean}, got ${baseline.mean}`);
        }
        if (Math.abs(expectedMedian - baseline.median) > tolerance) {
            errors.push(`Median mismatch: expected ${expectedMedian}, got ${baseline.median}`);
        }
        if (Math.abs(expectedStd - baseline.sampleStandardDeviation) > tolerance) {
            errors.push(`Std mismatch: expected ${expectedStd}, got ${baseline.sampleStandardDeviation}`);
        }

        return {
            verified: errors.length === 0,
            errors
        };
    }
};
