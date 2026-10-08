/**
 * Stage 07-C - Forecasting Module
 *
 * Exports for forecasting contracts, data preparation, baseline methods,
 * metrics, backtesting, and model selection.
 */

export {
    // Types
    ForecastMethod,
    ForecastStatus,
    ForecastRequest,
    ForecastPoint,
    ForecastEvidence,
    ForecastResult,
    ForecastMetrics,
    TrainValidationSplit,
    PreparedTimeSeries
} from "./ForecastTypes";

// Stage 07-C.C Types
export {
    BacktestSplit,
    BacktestResult,
    BacktestProvenance,
    BacktestConfig
} from "./BacktestTypes";

// Stage 07-C.D Types
export {
    CandidateStatus,
    CandidateResult,
    SelectionEvidence,
    ModelSelectionResult,
    ModelSelectionConfig
} from "./SelectionTypes";

export {
    // Data Preparation
    ForecastDataPreparation
} from "./ForecastDataPreparation";

export {
    // Baseline Forecast Engine
    BaselineForecastEngine
} from "./BaselineForecastEngine";

export {
    // Forecast Metrics
    ForecastMetricsCalculator
} from "./ForecastMetrics";

export {
    // Backtest Engine
    BacktestEngine
} from "./BacktestEngine";

export {
    // Model Selector
    ModelSelector
} from "./ModelSelector";
