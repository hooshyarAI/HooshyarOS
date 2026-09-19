/**
 * Stage 07-A/B - Temporal Data Foundation
 *
 * Exports for temporal data storage, aggregation, statistics, and baselines.
 */

export {
    // Types
    MetricObservation,
    AppendObservationInput,
    QueryObservationsInput,
    ObservationAppendResult,
    ObservationQueryResult,
    AggregationPeriod,
    AggregatedMetric,
    ValidationResult,
    StatisticalSummary,
    StatisticalProvenance,
    StatisticalMethod,
    TIMESTAMP_PATTERNS,
    METRIC_NAME_PATTERN,
    SOURCE_PATTERN
} from "./TemporalTypes";

// Stage 07-B Types
export {
    // Baseline Types
    DataQualityProfile,
    MissingnessReport,
    DuplicateReport,
    NonFiniteReport,
    TemporalGapReport,
    StatisticalBaseline,
    BaselineProvenance,
    BaselineComparisonResult,
    ZScoreContract,
    CreateBaselineInput,
    CompareBaselineInput
} from "./BaselineTypes";

export {
    // Validation
    TemporalValidator,
    ValidationError
} from "./TemporalValidator";

export {
    // Storage
    TimeSeriesStore,
    TimeSeriesStoreConfig
} from "./TimeSeriesStore";

export {
    // Aggregation
    TemporalAggregator,
    getISOWeekNumber,
    getPeriodBoundaries,
    formatPeriodStart,
    formatPeriodEnd,
    getPeriodKey,
    groupByPeriod
} from "./TemporalAggregator";

export {
    // Statistics
    DescriptiveStatistics
} from "./DescriptiveStatistics";

// Stage 07-B - Data Quality
export {
    DataQualityProfiler
} from "./DataQualityProfiler";

// Stage 07-B - Statistical Baselines
export {
    StatisticalBaselineEngine
} from "./StatisticalBaselineEngine";

// Stage 07-B - Baseline Comparison
export {
    BaselineComparison
} from "./BaselineComparison";
