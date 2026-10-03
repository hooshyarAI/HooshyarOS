/**
 * Stage 07-B - Baseline Types
 *
 * Type definitions for statistical baselines and data quality profiling.
 */

import { MetricObservation } from "./TemporalTypes";

/**
 * Missingness report
 */
export interface MissingnessReport {
    gaps: ReadonlyArray<{
        start: string;
        end: string;
        durationDays: number;
    }>;
    totalMissingDays: number;
    coveragePercent: number;
}

/**
 * Duplicate timestamp report
 */
export interface DuplicateReport {
    duplicateTimestamps: ReadonlyArray<string>;
    count: number;
}

/**
 * Non-finite value report
 */
export interface NonFiniteReport {
    invalidValues: ReadonlyArray<{
        timestamp: string;
        value: number;
    }>;
    count: number;
}

/**
 * Temporal gap report
 */
export interface TemporalGapReport {
    gaps: ReadonlyArray<{
        before: string;
        after: string;
        durationDays: number;
    }>;
    maxGapDays: number;
    avgGapDays: number;
}

/**
 * Data quality profile for a metric in a time window
 */
export interface DataQualityProfile {
    tenantId: string;
    metricName: string;
    timeWindow: {
        start: string;
        end: string;
    };
    observationCount: number;
    qualityFlags: ReadonlyArray<string>;
    missingness: MissingnessReport | null;
    duplicates: DuplicateReport | null;
    nonFiniteValues: NonFiniteReport | null;
    temporalGaps: TemporalGapReport | null;
}

/**
 * Statistical baseline for a metric
 */
export interface StatisticalBaseline {
    tenantId: string;
    metricName: string;
    timeWindow: {
        start: string;
        end: string;
    };
    observationCount: number;
    mean: number;
    median: number;
    sampleVariance: number;
    sampleStandardDeviation: number;
    min: number;
    max: number;
    percentiles: {
        p10: number;
        p25: number;
        p50: number;
        p75: number;
        p90: number;
    };
    statisticalConvention: {
        mean: "arithmetic";
        variance: "sample_n-1";
        percentile: "type7";
    };
    provenance: BaselineProvenance;
}

/**
 * Provenance for baseline calculations
 */
export interface BaselineProvenance {
    source: string;
    metric: string;
    tenant: string;
    timeWindow: {
        start: string;
        end: string;
    };
    observationCount: number;
    statisticalConvention: {
        mean: "arithmetic";
        variance: "sample_n-1";
        percentile: "type7";
    };
}

/**
 * Baseline comparison result
 */
export interface BaselineComparisonResult {
    tenantId: string;
    metricName: string;
    currentValue: number;
    baseline: StatisticalBaseline;
    absoluteDeviation: number;
    relativeDeviation: number | null;
    zScore: number | null;
    confidence: {
        source: "unavailable";
    };
    provenance: BaselineProvenance;
}

/**
 * Z-score calculation contract
 * Z-score requires:
 * - At least 30 observations (n >= 30) for reliable estimation
 * - Standard deviation > 0 (constant series has no z-score)
 */
export interface ZScoreContract {
    requiresMinObservations: 30;
    requiresNonZeroStdDev: true;
    method: "z-score";
    formula: "(current - mean) / std";
}

/**
 * Baseline creation input
 */
export interface CreateBaselineInput {
    observations: readonly MetricObservation[];
    source: string;
    minObservations?: number;
}

/**
 * Baseline comparison input
 */
export interface CompareBaselineInput {
    currentValue: number;
    baseline: StatisticalBaseline;
}
