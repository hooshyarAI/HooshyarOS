/**
 * Stage 07-D.A/B/C + 07-E + 07-F - Uncertainty Module
 *
 * Exports for uncertainty contract, residual foundation,
 * empirical prediction intervals, coverage/calibration evaluation,
 * Monte Carlo simulation, scenario risk, ML, ensemble, and anomaly.
 */

export {
    UncertaintyMethod,
    UncertaintyStatus,
    PredictionInterval,
    ForecastUncertainty,
    CalibrationEvidence,
    UncertaintyProvenance,
    ResidualObservation,
    ResidualSet,
    ResidualProvenance
} from "./UncertaintyTypes";

export { ResidualAnalyzer } from "./ResidualAnalyzer";

export { EmpiricalPredictionInterval } from "./EmpiricalPredictionInterval";

export {
    EmpiricalIntervalInput,
    EmpiricalIntervalResult,
    QuantileProvenance
} from "./EmpiricalPredictionInterval";

export { CalibrationEvaluator } from "./CalibrationEvaluator";

export {
    CalibrationStatus,
    CoverageLevelResult,
    HorizonCoverage,
    CalibrationReport,
    CalibrationProvenance,
    MultiLevelCalibrationReport,
    CalibrationConfig
} from "./CalibrationEvaluator";

// Stage 07-E: Monte Carlo / Scenario Risk
export { SeededRNG_create } from "./SeededRNG";
export type { SeededRNG } from "./SeededRNG";

export { simulate } from "./MonteCarloSimulator";

export { runScenarios, sensitivityAnalysis } from "./ScenarioEngine";

export type {
    Scenario,
    SimulationInput,
    SimulationStatistics,
    ScenarioResult,
    SensitivityResult,
    SimulationProvenance,
    SimulationStatus,
    SimulationResult,
    ResidualSetLike
} from "./MonteCarloTypes";

// Stage 07-F: ML / Ensemble / Anomaly
export { LinearRegressionModel } from "./LinearRegressionModel";
export { AnomalyDetector, DEFAULT_MAD_THRESHOLD, DEFAULT_ZSCORE_THRESHOLD } from "./AnomalyDetector";
export { EnsembleAggregator } from "./EnsembleAggregator";
export { TrainTestSplitter } from "./TrainTestSplitter";

export type {
    TrainingDataPoint,
    FeatureSpec,
    LinearModel,
    ModelIdentifier,
    ModelMetrics,
    TrainTestSplit,
    AnomalyScore,
    EnsemblePrediction,
    Provenance,
    ModelStatus
} from "./MLTypes";

export type { SourcePrediction, AggregateOptions } from "./EnsembleAggregator";
export type { AnomalyContext } from "./AnomalyDetector";
