/**
 * Stage 07-D.A/B/C + 07-E - Uncertainty Module
 *
 * Exports for uncertainty contract, residual foundation,
 * empirical prediction intervals, coverage/calibration evaluation,
 * Monte Carlo simulation, and scenario risk.
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
