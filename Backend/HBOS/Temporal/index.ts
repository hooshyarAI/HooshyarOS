/**
 * Stage 07-A - Temporal Data Foundation
 *
 * Exports for temporal data storage, aggregation, and statistics.
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
