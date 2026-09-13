/**
 * Stage 07-C - Forecasting Types
 *
 * Contract types for time-series forecasting.
 *
 * IMPORTANT:
 * - All forecast results include provenance
 * - No fabricated confidence
 * - Tenant isolation enforced
 * - Deterministic results
 */

/**
 * Available forecast methods
 */
export type ForecastMethod = "naive" | "seasonal_naive" | "moving_average" | "exponential_smoothing";

/**
 * Forecast status
 */
export type ForecastStatus = "success" | "insufficient_data" | "invalid_request" | "model_error";

/**
 * Forecast request
 */
export interface ForecastRequest {
    /** Tenant that owns this forecast */
    readonly tenantId: string;
    /** Name of the metric to forecast */
    readonly metricName: string;
    /** Start of training window (ISO 8601) */
    readonly trainingStart: string;
    /** End of training window (ISO 8601) */
    readonly trainingEnd: string;
    /** Number of periods to forecast ahead */
    readonly horizon: number;
    /** Forecast method to use */
    readonly method: ForecastMethod;
    /** Optional seasonal period (required for seasonal_naive) */
    readonly seasonalPeriod?: number;
    /** Optional moving average window (required for moving_average) */
    readonly movingAverageWindow?: number;
    /** Optional exponential smoothing alpha (required for exponential_smoothing) */
    readonly exponentialSmoothingAlpha?: number;
}

/**
 * A single forecast point
 */
export interface ForecastPoint {
    /** Forecast timestamp (ISO 8601) */
    readonly timestamp: string;
    /** Predicted value at this point */
    readonly predictedValue: number;
    /** Forecast step (1 = first forecast period) */
    readonly step: number;
}

/**
 * Forecast evidence / provenance
 */
export interface ForecastEvidence {
    /** Method used */
    readonly method: ForecastMethod;
    /** Tenant that owns this forecast */
    readonly tenantId: string;
    /** Metric being forecasted */
    readonly metricName: string;
    /** Training window */
    readonly trainingWindow: {
        readonly start: string;
        readonly end: string;
    };
    /** Forecast horizon */
    readonly horizon: number;
    /** Number of observations used for training */
    readonly observationCount: number;
    /** Model/configuration identifier */
    readonly modelId: string;
    /** When the forecast was generated (ISO 8601) */
    readonly calculatedAt: string;
    /** Confidence is always unavailable unless explicitly calculated */
    readonly confidence: {
        readonly source: "unavailable";
    };
}

/**
 * Forecast result
 */
export interface ForecastResult {
    /** Status of the forecast operation */
    readonly status: ForecastStatus;
    /** Tenant that owns this forecast */
    readonly tenantId: string;
    /** Metric being forecasted */
    readonly metricName: string;
    /** Forecast horizon */
    readonly horizon: number;
    /** Method used */
    readonly method: ForecastMethod;
    /** Forecast points (empty if status != success) */
    readonly points: ReadonlyArray<ForecastPoint>;
    /** Number of observations used for training */
    readonly observationCount: number;
    /** Evidence / provenance */
    readonly evidence: ForecastEvidence;
    /** Error message if status != success */
    readonly error?: string;
}

/**
 * Forecast metrics (for backtesting)
 */
export interface ForecastMetrics {
    /** Mean Absolute Error */
    readonly mae: number;
    /** Root Mean Squared Error */
    readonly rmse: number;
    /** Mean Absolute Percentage Error (null if invalid) */
    readonly mape: number | null;
    /** Symmetric Mean Absolute Percentage Error */
    readonly smape: number;
    /** Mean Absolute Scaled Error (null if no scaling factor) */
    readonly mase: number | null;
    /** Number of forecast points evaluated */
    readonly n: number;
}

/**
 * Training/validation split
 */
export interface TrainValidationSplit {
    /** Training observations (chronological order) */
    readonly training: ReadonlyArray<{
        readonly timestamp: string;
        readonly value: number;
    }>;
    /** Validation observations (chronological order, after training) */
    readonly validation: ReadonlyArray<{
        readonly timestamp: string;
        readonly value: number;
    }>;
    /** Validation origin (last training timestamp) */
    readonly validationOrigin: string;
    /** Total observations across both sets */
    readonly totalCount: number;
}

/**
 * Prepared time series
 */
export interface PreparedTimeSeries {
    /** Tenant that owns this series */
    readonly tenantId: string;
    /** Metric name */
    readonly metricName: string;
    /** Chronologically ordered observations (after deduplication) */
    readonly observations: ReadonlyArray<{
        readonly timestamp: string;
        readonly value: number;
    }>;
    /** Duplicate timestamps that were handled */
    readonly duplicatesRemoved: number;
    /** Number of non-finite values rejected */
    readonly nonFiniteRejected: number;
    /** Detected intervals between observations (in days) */
    readonly intervals: ReadonlyArray<number>;
    /** Detected interval mode (most common gap in days) */
    readonly intervalMode: number | null;
    /** Whether intervals are irregular */
    readonly isIrregular: boolean;
    /** First timestamp */
    readonly firstTimestamp: string;
    /** Last timestamp */
    readonly lastTimestamp: string;
}
