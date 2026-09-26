/**
 * Stage 07-D.A - Uncertainty Types
 *
 * Contract types for uncertainty and prediction intervals.
 *
 * IMPORTANT:
 * - No fabricated confidence
 * - Distinguishes unavailable, calculated, insufficient_data
 * - Confidence is NOT a substitute for uncertainty
 */

/**
 * Uncertainty method type
 */
export type UncertaintyMethod = "residual_std" | "quantile_empirical" | "normal_assumption";

/**
 * Uncertainty status
 */
export type UncertaintyStatus = "unavailable" | "insufficient_data" | "calculated" | "invalid_request" | "model_error";

/**
 * A single prediction interval point
 */
export interface PredictionInterval {
    /** Forecast timestamp */
    readonly timestamp: string;
    /** Point forecast value */
    readonly pointForecast: number;
    /** Lower bound of interval */
    readonly lowerBound: number;
    /** Upper bound of interval */
    readonly upperBound: number;
    /** Confidence level (e.g., 0.95 for 95% interval) */
    readonly confidenceLevel: number;
    /** Step number (1-based) */
    readonly step: number;
}

/**
 * Forecast uncertainty (result)
 */
export interface ForecastUncertainty {
    /** Tenant ID */
    readonly tenantId: string;
    /** Metric name */
    readonly metricName: string;
    /** Forecasting method used */
    readonly method: string;
    /** Forecast horizon */
    readonly horizon: number;
    /** Number of residuals used for uncertainty estimation */
    readonly residualCount: number;
    /** Prediction intervals (one per forecast point) */
    readonly intervals: ReadonlyArray<PredictionInterval>;
    /** Method used for uncertainty */
    readonly uncertaintyMethod: UncertaintyMethod | null;
    /** Confidence level used */
    readonly confidenceLevel: number | null;
    /** Calibration evidence */
    readonly calibration: CalibrationEvidence | null;
    /** Status */
    readonly status: UncertaintyStatus;
    /** Provenance */
    readonly provenance: UncertaintyProvenance;
    /** Error message if status != calculated */
    readonly error?: string;
}

/**
 * Calibration evidence
 */
export interface CalibrationEvidence {
    /** Number of residuals available for calibration */
    readonly residualCount: number;
    /** Mean residual (should be near 0 for unbiased model) */
    readonly meanResidual: number;
    /** Standard deviation of residuals */
    readonly residualStd: number;
    /** Minimum residual */
    readonly minResidual: number;
    /** Maximum residual */
    readonly maxResidual: number;
    /** Method used to derive statistics */
    readonly method: string;
    /** Whether the calibration is sufficient for valid intervals */
    readonly isCalibrated: boolean;
    /** Minimum required residuals (e.g., 30 for central limit theorem) */
    readonly minRequiredResiduals: number;
}

/**
 * Uncertainty provenance
 */
export interface UncertaintyProvenance {
    /** Source identifier */
    readonly source: string;
    /** Tenant */
    readonly tenant: string;
    /** Metric */
    readonly metric: string;
    /** Method */
    readonly method: string;
    /** Number of residuals */
    readonly residualCount: number;
    /** Calculation timestamp */
    readonly calculatedAt: string;
}

/**
 * A single residual observation
 */
export interface ResidualObservation {
    /** Tenant ID */
    readonly tenantId: string;
    /** Metric name */
    readonly metricName: string;
    /** Forecasting method that produced the prediction */
    readonly forecastingMethod: string;
    /** Origin timestamp (last training timestamp) */
    readonly originTimestamp: string;
    /** Forecast timestamp (when actual was observed) */
    readonly forecastTimestamp: string;
    /** Actual observed value */
    readonly actual: number;
    /** Predicted value */
    readonly prediction: number;
    /** Residual (actual - prediction) */
    readonly residual: number;
    /** Split index from backtest */
    readonly splitIndex: number;
    /** Step within the forecast horizon */
    readonly step: number;
}

/**
 * Residual set (extracted from a backtest result)
 */
export interface ResidualSet {
    /** Tenant ID */
    readonly tenantId: string;
    /** Metric name */
    readonly metricName: string;
    /** Forecasting method */
    readonly method: string;
    /** Total observations evaluated */
    readonly observationCount: number;
    /** Number of finite residuals (excludes NaN/Inf) */
    readonly finiteResidualCount: number;
    /** Residuals in chronological order (origin, then step) */
    readonly residuals: ReadonlyArray<ResidualObservation>;
    /** Provenance */
    readonly provenance: ResidualProvenance;
}

/**
 * Residual provenance
 */
export interface ResidualProvenance {
    readonly source: string;
    readonly tenant: string;
    readonly metric: string;
    readonly method: string;
    readonly backtestSplitCount: number;
    readonly extractedAt: string;
}
