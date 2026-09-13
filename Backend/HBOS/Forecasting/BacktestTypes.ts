/**
 * Stage 07-C.C - Backtest Types
 *
 * Type definitions for walk-forward backtesting.
 */

/**
 * A single backtest split result
 */
export interface BacktestSplit {
    /** Split index (0-based) */
    readonly splitIndex: number;
    /** Training window [start, end] */
    readonly trainingWindow: {
        readonly start: string;
        readonly end: string;
    };
    /** Validation window [start, end] */
    readonly validationWindow: {
        readonly start: string;
        readonly end: string;
    };
    /** Number of training observations */
    readonly trainingCount: number;
    /** Number of validation observations */
    readonly validationCount: number;
    /** Forecasted values */
    readonly predictions: ReadonlyArray<{
        readonly timestamp: string;
        readonly predictedValue: number;
    }>;
    /** Actual values from validation set */
    readonly actuals: ReadonlyArray<{
        readonly timestamp: string;
        readonly actualValue: number;
    }>;
    /** Metrics for this split */
    readonly metrics: {
        readonly mae: number;
        readonly rmse: number;
        readonly mape: number | null;
        readonly smape: number;
        readonly n: number;
    };
    /** Leakage verification for this split */
    readonly leakageCheck: {
        readonly trainingMaxTimestamp: string;
        readonly validationMinTimestamp: string;
        readonly noLeakage: boolean;
    };
}

/**
 * Backtest result
 */
export interface BacktestResult {
    readonly status: "success" | "insufficient_data" | "invalid_request";
    readonly tenantId: string;
    readonly metricName: string;
    readonly method: string;
    readonly numberOfSplits: number;
    readonly forecastHorizon: number;
    readonly splits: ReadonlyArray<BacktestSplit>;
    readonly aggregateMetrics: {
        readonly mae: number;
        readonly rmse: number;
        readonly mape: number | null;
        readonly smape: number;
        readonly n: number;
    };
    readonly overallWindow: {
        readonly start: string;
        readonly end: string;
    };
    readonly provenance: BacktestProvenance;
    readonly leakageStatus: {
        readonly verified: boolean;
        readonly allSplitsHaveNoLeakage: boolean;
        readonly checkedAt: string;
    };
    readonly error?: string;
}

/**
 * Backtest provenance
 */
export interface BacktestProvenance {
    readonly source: string;
    readonly tenant: string;
    readonly metric: string;
    readonly method: string;
    readonly overallWindow: {
        readonly start: string;
        readonly end: string;
    };
    readonly totalObservations: number;
    readonly numberOfSplits: number;
    readonly forecastHorizon: number;
    readonly metricDefinitions: {
        readonly mae: "mean(|y - yhat|)";
        readonly rmse: "sqrt(mean((y - yhat)^2))";
        readonly mape: "mean(|(y-yhat)/y|) * 100, excluding y=0";
        readonly smape: "mean(2|y-yhat|/(|y|+|yhat|)) * 100, excluding zero denominators";
    };
    readonly calculatedAt: string;
}

/**
 * Backtest configuration
 */
export interface BacktestConfig {
    /** Tenant ID */
    readonly tenantId: string;
    /** Metric name */
    readonly metricName: string;
    /** Start of overall backtest window */
    readonly startTime: string;
    /** End of overall backtest window */
    readonly endTime: string;
    /** Forecast method */
    readonly method: "naive" | "seasonal_naive" | "moving_average" | "exponential_smoothing";
    /** Number of observations in each training window (before rolling) */
    readonly initialTrainingSize: number;
    /** Number of observations in each validation window */
    readonly validationSize: number;
    /** Number of steps to advance the origin between splits */
    readonly stepSize?: number;
    /** Optional seasonal period for seasonal_naive */
    readonly seasonalPeriod?: number;
    /** Optional moving average window for moving_average */
    readonly movingAverageWindow?: number;
    /** Optional exponential smoothing alpha */
    readonly exponentialSmoothingAlpha?: number;
}
