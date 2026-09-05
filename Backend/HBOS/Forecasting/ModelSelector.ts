/**
 * Stage 07-C.D - Model Selector
 *
 * Deterministic forecast model selection using walk-forward backtest.
 *
 * IMPORTANT:
 * - Selection based ONLY on historical backtest results
 * - No future leakage
 * - MAE primary, RMSE tie-break, then deterministic method priority
 * - All candidates evaluated on identical splits
 * - No fabricated scores
 */

import { TimeSeriesStore } from "../Temporal/TimeSeriesStore";
import { ForecastDataPreparation } from "./ForecastDataPreparation";
import { BacktestEngine } from "./BacktestEngine";
import { PreparedTimeSeries, ForecastMethod } from "./ForecastTypes";
import {
    ModelSelectionConfig,
    ModelSelectionResult,
    CandidateResult,
    SelectionEvidence,
    CandidateStatus
} from "./SelectionTypes";

/**
 * Default method priority (lower index = higher priority in tie-breaks)
 */
const DEFAULT_METHOD_PRIORITY: ReadonlyArray<ForecastMethod> = [
    "naive",
    "moving_average",
    "exponential_smoothing",
    "seasonal_naive"
];

/**
 * Default candidate methods
 */
const DEFAULT_CANDIDATE_METHODS: ReadonlyArray<ForecastMethod> = [
    "naive",
    "moving_average",
    "exponential_smoothing",
    "seasonal_naive"
];

/**
 * ModelSelector - Deterministic forecast model selection
 */
export const ModelSelector = {
    /**
     * Run model selection from TimeSeriesStore
     */
    async select(store: TimeSeriesStore, config: ModelSelectionConfig): Promise<ModelSelectionResult> {
        // Prepare time series
        const series = await ForecastDataPreparation.prepare(store, {
            tenantId: config.tenantId,
            metricName: config.metricName,
            trainingStart: config.startTime,
            trainingEnd: config.endTime,
            horizon: config.validationSize,
            method: "naive"
        });

        if (!series) {
            return createErrorResult(config, "insufficient_data", "No valid observations in evaluation window");
        }

        return this.selectFromSeries(series, config);
    },

    /**
     * Run model selection from a pre-prepared series
     */
    selectFromSeries(series: PreparedTimeSeries, config: ModelSelectionConfig): ModelSelectionResult {
        // Validate config
        const validation = validateConfig(config, series);
        if (!validation.valid) {
            return createErrorResult(config, "invalid_request", validation.error);
        }

        const candidateMethods = config.candidateMethods || DEFAULT_CANDIDATE_METHODS;
        const methodPriority = config.methodPriority || DEFAULT_METHOD_PRIORITY;
        const candidateResults: CandidateResult[] = [];
        let allLeakageVerified = true;

        // Evaluate each candidate
        for (const method of candidateMethods) {
            const candidateEval = evaluateCandidate(series, config, method);
            candidateResults.push(candidateEval.result);
            if (!candidateEval.leakageOk) {
                allLeakageVerified = false;
            }
        }

        // Select best candidate
        const validCandidates = candidateResults.filter(c => c.status === "applicable");
        let selectedMethod: ForecastMethod | null = null;
        let selectedMAE: number | null = null;
        let selectedRMSE: number | null = null;

        if (validCandidates.length === 0) {
            return {
                status: "no_valid_candidates",
                tenantId: config.tenantId,
                metricName: config.metricName,
                selectedMethod: null,
                candidates: Object.freeze([...candidateResults]),
                evidence: createEvidence(config, candidateResults, null, null, null, allLeakageVerified)
            };
        }

        // Sort by MAE ascending, then RMSE ascending, then method priority
        const sorted = sortCandidates(validCandidates, methodPriority);
        const best = sorted[0];
        selectedMethod = best.method;
        selectedMAE = best.mae;
        selectedRMSE = best.rmse;

        return {
            status: "success",
            tenantId: config.tenantId,
            metricName: config.metricName,
            selectedMethod,
            candidates: Object.freeze([...candidateResults]),
            evidence: createEvidence(config, candidateResults, selectedMethod, selectedMAE, selectedRMSE, allLeakageVerified)
        };
    }
};

/**
 * Evaluate a single candidate method
 */
function evaluateCandidate(
    series: PreparedTimeSeries,
    config: ModelSelectionConfig,
    method: ForecastMethod
): { result: CandidateResult; leakageOk: boolean } {
    // Build backtest config for this candidate
    const backtestConfig = {
        tenantId: config.tenantId,
        metricName: config.metricName,
        startTime: config.startTime,
        endTime: config.endTime,
        method,
        initialTrainingSize: config.initialTrainingSize,
        validationSize: config.validationSize,
        stepSize: config.stepSize,
        seasonalPeriod: method === "seasonal_naive" ? config.candidateSeasonalPeriod : undefined,
        movingAverageWindow: method === "moving_average" ? config.candidateMovingAverageWindow : undefined,
        exponentialSmoothingAlpha: method === "exponential_smoothing" ? config.candidateExponentialSmoothingAlpha : undefined
    };

    // Run backtest
    const backtestResult = BacktestEngine.runFromSeries(series, backtestConfig);

    if (backtestResult.status === "invalid_request") {
        return {
            result: {
                method,
                status: "invalid_config",
                mae: null,
                rmse: null,
                numberOfSplits: 0,
                reason: backtestResult.error
            },
            leakageOk: true
        };
    }

    if (backtestResult.status === "insufficient_data" ||
        backtestResult.numberOfSplits === 0 ||
        backtestResult.aggregateMetrics.n === 0) {
        return {
            result: {
                method,
                status: "insufficient_data",
                mae: null,
                rmse: null,
                numberOfSplits: backtestResult.numberOfSplits,
                reason: "Not enough observations for this method to produce valid predictions"
            },
            leakageOk: true
        };
    }

    return {
        result: {
            method,
            status: "applicable",
            mae: backtestResult.aggregateMetrics.mae,
            rmse: backtestResult.aggregateMetrics.rmse,
            numberOfSplits: backtestResult.numberOfSplits
        },
        leakageOk: backtestResult.leakageStatus.allSplitsHaveNoLeakage
    };
}

/**
 * Sort candidates by MAE, then RMSE, then method priority
 */
function sortCandidates(
    candidates: ReadonlyArray<CandidateResult>,
    methodPriority: ReadonlyArray<ForecastMethod>
): ReadonlyArray<CandidateResult> {
    return [...candidates].sort((a, b) => {
        // Primary: MAE ascending
        if ((a.mae ?? Infinity) !== (b.mae ?? Infinity)) {
            return (a.mae ?? Infinity) - (b.mae ?? Infinity);
        }
        // Tie-break: RMSE ascending
        if ((a.rmse ?? Infinity) !== (b.rmse ?? Infinity)) {
            return (a.rmse ?? Infinity) - (b.rmse ?? Infinity);
        }
        // Final tie-break: method priority
        const aPriority = methodPriority.indexOf(a.method);
        const bPriority = methodPriority.indexOf(b.method);
        return aPriority - bPriority;
    });
}

/**
 * Create selection evidence
 */
function createEvidence(
    config: ModelSelectionConfig,
    candidateResults: ReadonlyArray<CandidateResult>,
    selectedMethod: ForecastMethod | null,
    selectedMAE: number | null,
    selectedRMSE: number | null,
    leakageVerified: boolean
): SelectionEvidence {
    const methodPriority = config.methodPriority || DEFAULT_METHOD_PRIORITY;
    return {
        source: "model-selector",
        tenant: config.tenantId,
        metric: config.metricName,
        evaluationWindow: {
            start: config.startTime,
            end: config.endTime
        },
        candidateMethods: Object.freeze([...(config.candidateMethods || DEFAULT_CANDIDATE_METHODS)]),
        candidateResults: Object.freeze([...candidateResults]),
        numberOfSplits: candidateResults.length > 0
            ? Math.max(...candidateResults.map(c => c.numberOfSplits))
            : 0,
        selectionMetric: "MAE",
        tieBreakRule: "RMSE, then deterministic method priority",
        methodPriority: Object.freeze([...methodPriority]),
        selectedMethod,
        selectedMAE,
        selectedRMSE,
        leakageStatus: {
            verified: leakageVerified,
            allSplitsHaveNoLeakage: leakageVerified
        },
        calculatedAt: "2026-01-01T00:00:00Z"
    };
}

/**
 * Create an error result
 */
function createErrorResult(
    config: ModelSelectionConfig,
    status: "insufficient_data" | "no_valid_candidates" | "invalid_request",
    error: string
): ModelSelectionResult {
    return {
        status,
        tenantId: config.tenantId,
        metricName: config.metricName,
        selectedMethod: null,
        candidates: Object.freeze([]),
        evidence: createEvidence(config, [], null, null, null, false),
        error
    };
}

/**
 * Validate model selection configuration
 */
function validateConfig(
    config: ModelSelectionConfig,
    series: PreparedTimeSeries
): { valid: boolean; error: string } {
    if (!config.tenantId) {
        return { valid: false, error: "tenantId is required" };
    }
    if (!config.metricName) {
        return { valid: false, error: "metricName is required" };
    }
    if (config.initialTrainingSize < 1) {
        return { valid: false, error: "initialTrainingSize must be >= 1" };
    }
    if (config.validationSize < 1) {
        return { valid: false, error: "validationSize must be >= 1" };
    }
    if (config.initialTrainingSize + config.validationSize > series.observations.length) {
        return {
            valid: false,
            error: `initialTrainingSize + validationSize > total observations`
        };
    }
    return { valid: true, error: "" };
}
