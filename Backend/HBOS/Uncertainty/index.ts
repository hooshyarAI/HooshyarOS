/**
 * Stage 07-D.A/B/C + 07-E + 07-F + 07-G + 07-H - Uncertainty Module
 *
 * Exports for uncertainty contract, residual foundation,
 * empirical prediction intervals, coverage/calibration evaluation,
 * Monte Carlo simulation, scenario risk, ML, ensemble, anomaly,
 * Bayesian / Optimization, Causal / Counterfactual.
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

// Stage 07-G: Bayesian / Optimization
export { ConjugateBayesian } from "./ConjugateBayesian";
export { PosteriorPredictive } from "./PosteriorPredictive";
export { Optimizer } from "./Optimizer";

export type {
    Prior,
    NormalPrior,
    BetaPrior,
    UniformPrior,
    PointPrior,
    Likelihood,
    NormalLikelihood,
    BinomialLikelihood,
    PoissonLikelihood,
    Posterior,
    NormalPosterior,
    BetaPosterior,
    UniformPosterior,
    PointPosterior,
    CredibleInterval,
    BayesianUpdate,
    ObjectiveFunction,
    Constraint,
    BoundConstraint,
    LinearConstraint,
    OptimizationResult,
    BayesianProvenance,
    OptimizationStatus,
    PriorType,
    LikelihoodType,
    PosteriorDistributionType
} from "./BayesianTypes";

// Stage 07-H: Causal / Counterfactual
export { AdjustmentEstimator } from "./AdjustmentEstimator";
export { ConfoundingDetector } from "./ConfoundingDetector";
export { PropensityScore } from "./PropensityScore";
export { CounterfactualEngine } from "./CounterfactualEngine";

export type {
    TreatmentVariable,
    OutcomeVariable,
    Covariate,
    CausalAssumptions,
    CausalEstimand,
    CausalEffect,
    CausalResult,
    CounterfactualScenario,
    CausalStatus,
    CausalProvenance,
    CounterfactualStatus,
    TreatmentType,
    VariableType
} from "./CausalTypes";
// Stage 07-I: NLP / Grounded LLM Intelligence
export {
    retrieve,
    searchKnowledge
} from "./EvidenceRetriever";

export type {
    EvidenceChunk,
    RetrievalQuery,
    RetrievalResult,
    GroundedResponse,
    GroundedStatus,
    LLMProvider,
    LLMProviderType,
    PromptContext,
    LLMEnrichment,
    ResponseProvenance
} from "./NLPTypes";

export { build } from "./GroundedResponseBuilder";

export {
    NullProvider,
    LocalStubProvider,
    createNullProvider,
    createLocalStubProvider,
    enrichAnswer
} from "./LLMProviderInterface";

export { validateGroundedResponse } from "./HallucinationGuard";

// Stage 07-J: Explainability / Model Evaluation
export {
    EvaluationRecordBuilder
} from "./EvaluationRecordBuilder";

export {
    DriftDetector
} from "./DriftDetector";

export {
    FeatureContributionAnalyzer
} from "./FeatureContribution";

export {
    AssumptionValidator
} from "./AssumptionValidator";

export {
    EvaluationRegistry
} from "./EvaluationRegistry";

export type {
    MethodIdentifier,
    EvaluationMetric,
    BaselineComparison,
    CalibrationSummary,
    DriftIndicator,
    FeatureContribution as FeatureContributionType,
    ExplanationEvidence,
    MethodAssumption,
    MethodLimitation,
    EvaluationProvenance,
    EvaluationRecord
} from "./EvaluationTypes";
