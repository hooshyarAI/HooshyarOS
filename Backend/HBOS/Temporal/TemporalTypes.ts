/**
 * Stage 07-A - Temporal Data Foundation
 *
 * Canonical temporal observation representation for time-series analytics.
 *
 * Design principles:
 * - Tenant-scoped temporal data
 * - Immutable observations (append-only)
 * - Deterministic ordering by timestamp
 * - Provenance tracking for reproducibility
 * - No statistical assumptions embedded in storage
 */

/**
 * A temporal observation is a single time-indexed measurement.
 *
 * IMPORTANT: This represents OBSERVED data, not computed statistics.
 * The source field indicates provenance.
 */
export interface MetricObservation {
    /** Unique observation identifier */
    readonly id: string;
    /** Tenant that owns this observation */
    readonly tenantId: string;
    /** Name of the metric (e.g., "revenue", "expenses", "profit_margin") */
    readonly metricName: string;
    /** The observed value */
    readonly value: number;
    /**
     * Timestamp of the observation.
     * Convention: ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)
     * Aggregation level should be implicit from the metric name or explicit in the metricName
     */
    readonly timestamp: string;
    /**
     * Source of the observation.
     * Examples: "financial_ingestion:{sha256}", "manual_entry", "computed:{formula}"
     */
    readonly source: string;
    /**
     * Optional reference to the input/data that generated this observation.
     * For computed metrics, this should reference the source observations.
     */
    readonly provenanceRef?: string;
    /**
     * Metadata about data quality at observation time.
     * Not used for validation - just preservation of known quality issues.
     */
    readonly qualityFlags?: readonly string[];
    /** When this observation was recorded */
    readonly recordedAt: string;
}

/**
 * Result of appending an observation
 */
export interface ObservationAppendResult {
    readonly success: boolean;
    readonly observation?: MetricObservation;
    readonly error?: string;
}

/**
 * Result of querying observations
 */
export interface ObservationQueryResult {
    readonly success: boolean;
    readonly observations?: readonly MetricObservation[];
    readonly count: number;
    readonly error?: string;
}

/**
 * Aggregation period for temporal aggregation
 */
export type AggregationPeriod = "daily" | "weekly" | "monthly";

/**
 * An aggregated metric summary over a time period
 */
export interface AggregatedMetric {
    readonly tenantId: string;
    readonly metricName: string;
    readonly period: AggregationPeriod;
    /** Period start (inclusive) in ISO 8601 */
    readonly periodStart: string;
    /** Period end (exclusive) in ISO 8601 */
    readonly periodEnd: string;
    /** Number of observations in this period */
    readonly observationCount: number;
    readonly sum: number;
    readonly mean: number;
    readonly min: number;
    readonly max: number;
    readonly firstValue: number;
    readonly lastValue: number;
    readonly firstTimestamp: string;
    readonly lastTimestamp: string;
    readonly source: string;
}

/**
 * Input for appending an observation
 */
export interface AppendObservationInput {
    readonly tenantId: string;
    readonly metricName: string;
    readonly value: number;
    readonly timestamp: string;
    readonly source: string;
    readonly provenanceRef?: string;
    readonly qualityFlags?: readonly string[];
}

/**
 * Query parameters for retrieving observations
 */
export interface QueryObservationsInput {
    readonly tenantId: string;
    readonly metricName: string;
    /** Start of time range (inclusive) */
    readonly startTime: string;
    /** End of time range (exclusive) */
    readonly endTime: string;
    /** Optional limit for latest observations */
    readonly limit?: number;
}

/**
 * Data quality validation result
 */
export interface ValidationResult {
    readonly valid: boolean;
    readonly errors: readonly string[];
}

/**
 * Statistical summary of a set of observations
 */
export interface StatisticalSummary {
    readonly tenantId: string;
    readonly metricName: string;
    readonly startTime: string;
    readonly endTime: string;
    readonly observationCount: number;
    readonly min: number;
    readonly max: number;
    readonly sum: number;
    readonly mean: number;
    readonly median: number;
    readonly sampleVariance: number;
    readonly sampleStandardDeviation: number;
    readonly percentiles: {
        readonly p10?: number;
        readonly p25?: number;
        readonly p50: number;
        readonly p75?: number;
        readonly p90?: number;
    };
    readonly method: {
        readonly mean: string;
        readonly median: string;
        readonly variance: "sample" | "population";
        readonly percentiles: string;
    };
    readonly provenance: StatisticalProvenance;
}

/**
 * Provenance information for statistical outputs
 */
export interface StatisticalProvenance {
    readonly traceId: string;
    readonly inputRef: string;
    readonly method: string;
    readonly timestamp: string;
}

/**
 * Statistical computation method metadata
 */
export const StatisticalMethod = {
    MEAN: "arithmetic_mean",
    MEDIAN: "median",
    VARIANCE_SAMPLE: "sample_variance_bessel",
    STD_SAMPLE: "sample_standard_deviation_bessel",
    PERCENTILE: "linear_interpolation_percentile"
} as const;

/**
 * Timestamp validation patterns
 */
export const TIMESTAMP_PATTERNS = {
    /** Full ISO 8601 with time */
    ISO_FULL: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/,
    /** Date only */
    ISO_DATE: /^\d{4}-\d{2}-\d{2}$/,
    /** Valid year-month-day combination */
    NUMERIC_DATE: /^\d{4}-\d{2}-\d{2}/
} as const;

/**
 * Metric name validation pattern
 * Allows: alphanumeric, underscore, dash, dot
 * Max 64 characters
 */
export const METRIC_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_\-.]{0,63}$/;

/**
 * Source validation pattern
 * Allows: alphanumeric, underscore, dash, colon, slash
 */
export const SOURCE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_\-:\/.]{0,127}$/;
