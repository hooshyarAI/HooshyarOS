/**
 * Stage 07-C.D - Model Selection Types
 *
 * Type definitions for deterministic model selection.
 */

import { ForecastMethod } from "./ForecastTypes";

/**
 * Status of a candidate method in selection
 */
export type CandidateStatus = "applicable" | "insufficient_data" | "invalid_config" | "not_applicable";

/**
 * A single candidate's evaluation result
 */
export interface CandidateResult {
    /** Method name */
    readonly method: ForecastMethod;
    /** Status of this candidate */
    readonly status: CandidateStatus;
    /** MAE (only if applicable) */
    readonly mae: number | null;
    /** RMSE (only if applicable) */
    readonly rmse: number | null;
    /** Number of backtest splits evaluated */
    readonly numberOfSplits: number;
    /** Reason if not applicable */
    readonly reason?: string;
}

/**
 * Model selection evidence
 */
export interface SelectionEvidence {
    /** Source identifier */
    readonly source: string;
    /** Tenant ID */
    readonly tenant: string;
    /** Metric name */
    readonly metric: string;
    /** Evaluation window */
    readonly evaluationWindow: {
        readonly start: string;
        readonly end: string;
    };
    /** All candidates evaluated */
    readonly candidateMethods: ReadonlyArray<ForecastMethod>;
    /** Per-candidate results */
    readonly candidateResults: ReadonlyArray<CandidateResult>;
    /** Number of backtest splits used */
    readonly numberOfSplits: number;
    /** Primary selection metric */
    readonly selectionMetric: "MAE";
    /** Tie-break rule */
    readonly tieBreakRule: "RMSE, then deterministic method priority";
    /** Method priority for tie-break (lower = higher priority) */
    readonly methodPriority: ReadonlyArray<ForecastMethod>;
    /** Selected method */
    readonly selectedMethod: ForecastMethod | null;
    /** Selected MAE (or null if no valid candidate) */
    readonly selectedMAE: number | null;
    /** Selected RMSE (or null if no valid candidate) */
    readonly selectedRMSE: number | null;
    /** Leakage status */
    readonly leakageStatus: {
        readonly verified: boolean;
        readonly allSplitsHaveNoLeakage: boolean;
    };
    /** Calculation timestamp */
    readonly calculatedAt: string;
}

/**
 * Model selection result
 */
export interface ModelSelectionResult {
    /** Status of the selection */
    readonly status: "success" | "insufficient_data" | "no_valid_candidates" | "invalid_request";
    /** Tenant ID */
    readonly tenantId: string;
    /** Metric name */
    readonly metricName: string;
    /** Selected method (null if no valid candidate) */
    readonly selectedMethod: ForecastMethod | null;
    /** All candidate results */
    readonly candidates: ReadonlyArray<CandidateResult>;
    /** Selection evidence */
    readonly evidence: SelectionEvidence;
    /** Error message if applicable */
    readonly error?: string;
}

/**
 * Model selection configuration
 */
export interface ModelSelectionConfig {
    /** Tenant ID */
    readonly tenantId: string;
    /** Metric name */
    readonly metricName: string;
    /** Evaluation window start */
    readonly startTime: string;
    /** Evaluation window end */
    readonly endTime: string;
    /** Initial training size for backtest splits */
    readonly initialTrainingSize: number;
    /** Validation size (forecast horizon) for each split */
    readonly validationSize: number;
    /** Step size for rolling origin */
    readonly stepSize?: number;
    /** Seasonal period to test (for seasonal_naive candidate) */
    readonly candidateSeasonalPeriod?: number;
    /** Moving average window to test (for moving_average candidate) */
    readonly candidateMovingAverageWindow?: number;
    /** Exponential smoothing alpha to test (for exp_smoothing candidate) */
    readonly candidateExponentialSmoothingAlpha?: number;
    /** Candidate methods to evaluate (default: all applicable) */
    readonly candidateMethods?: ReadonlyArray<ForecastMethod>;
    /** Method priority for tie-breaking (default order) */
    readonly methodPriority?: ReadonlyArray<ForecastMethod>;
}
