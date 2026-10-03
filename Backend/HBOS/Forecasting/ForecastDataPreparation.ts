/**
 * Stage 07-C - Forecast Data Preparation
 *
 * Deterministic data preparation for forecasting.
 *
 * IMPORTANT:
 * - Reuses Stage 07-A TimeSeriesStore
 * - Tenant-scoped retrieval
 * - Chronological ordering
 * - Explicit duplicate policy (last-write-wins)
 * - Irregular interval detection
 * - Missing-value handling WITHOUT silent invention
 * - Deterministic train/validation split
 * - No future leakage
 */

import { MetricObservation } from "../Temporal/TemporalTypes";
import { TimeSeriesStore } from "../Temporal/TimeSeriesStore";
import {
    PreparedTimeSeries,
    TrainValidationSplit,
    ForecastRequest
} from "./ForecastTypes";

/**
 * ForecastDataPreparation - Deterministic data preparation for forecasting
 */
export const ForecastDataPreparation = {
    /**
     * Prepare time series from store
     *
     * - Loads observations for tenant+metric
     * - Filters to training window
     * - Removes duplicates (last-write-wins)
     * - Rejects non-finite values
     * - Sorts chronologically
     * - Detects irregular intervals
     */
    async prepare(
        store: TimeSeriesStore,
        request: ForecastRequest
    ): Promise<PreparedTimeSeries | null> {
        // Load observations from store
        const queryResult = await store.query({
            tenantId: request.tenantId,
            metricName: request.metricName,
            startTime: request.trainingStart,
            endTime: request.trainingEnd
        });

        if (!queryResult.success) {
            return null;
        }

        const observations = queryResult.observations || [];

        if (observations.length === 0) {
            return null;
        }

        // Reject non-finite values (no silent coercion)
        const finiteObs: MetricObservation[] = [];
        let nonFiniteRejected = 0;
        for (const obs of observations) {
            if (Number.isFinite(obs.value)) {
                finiteObs.push(obs);
            } else {
                nonFiniteRejected++;
            }
        }

        if (finiteObs.length === 0) {
            return null;
        }

        // Sort chronologically
        const sorted = [...finiteObs].sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // Deduplicate (last-write-wins based on recordedAt)
        const deduped = deduplicateObservations(sorted);
        const duplicatesRemoved = sorted.length - deduped.length;

        // Detect intervals
        const intervals: number[] = [];
        for (let i = 1; i < deduped.length; i++) {
            const prevTime = new Date(deduped[i-1].timestamp).getTime();
            const currTime = new Date(deduped[i].timestamp).getTime();
            const intervalDays = (currTime - prevTime) / (1000 * 60 * 60 * 24);
            intervals.push(Math.round(intervalDays * 1000) / 1000);
        }

        // Detect interval mode
        const intervalMode = detectIntervalMode(intervals);
        const isIrregular = isIntervalIrregular(intervals, intervalMode);

        return Object.freeze({
            tenantId: request.tenantId,
            metricName: request.metricName,
            observations: Object.freeze(
                deduped.map(o => Object.freeze({
                    timestamp: o.timestamp,
                    value: o.value
                }))
            ),
            duplicatesRemoved,
            nonFiniteRejected,
            intervals: Object.freeze(intervals),
            intervalMode,
            isIrregular,
            firstTimestamp: deduped[0].timestamp,
            lastTimestamp: deduped[deduped.length - 1].timestamp
        });
    },

    /**
     * Create train/validation split
     *
     * IMPORTANT: No future leakage
     * - Training data is before the split point
     * - Validation data is after the split point
     * - Split point is the validation origin
     */
    split(
        series: PreparedTimeSeries,
        validationCount: number
    ): TrainValidationSplit | null {
        if (validationCount < 0) {
            return null;
        }
        if (validationCount >= series.observations.length) {
            return null;
        }

        const splitIndex = series.observations.length - validationCount;
        const training = series.observations.slice(0, splitIndex);
        const validation = series.observations.slice(splitIndex);

        if (training.length === 0) {
            return null;
        }

        return Object.freeze({
            training: Object.freeze([...training]),
            validation: Object.freeze([...validation]),
            validationOrigin: training[training.length - 1].timestamp,
            totalCount: series.observations.length
        });
    },

    /**
     * Create rolling-origin splits for walk-forward validation
     *
     * For each split:
     * - Training data is observations before the validation window
     * - Validation data is observations in the validation window
     */
    createRollingOriginSplits(
        series: PreparedTimeSeries,
        initialTrainingSize: number,
        validationSize: number,
        stepSize: number = 1
    ): ReadonlyArray<TrainValidationSplit> {
        const splits: TrainValidationSplit[] = [];
        const n = series.observations.length;

        if (initialTrainingSize <= 0 || validationSize <= 0 || stepSize <= 0) {
            return Object.freeze([]);
        }

        let trainEnd = initialTrainingSize;
        while (trainEnd + validationSize <= n) {
            const training = series.observations.slice(0, trainEnd);
            const validation = series.observations.slice(trainEnd, trainEnd + validationSize);

            splits.push(Object.freeze({
                training: Object.freeze([...training]),
                validation: Object.freeze([...validation]),
                validationOrigin: training[training.length - 1].timestamp,
                totalCount: n
            }));

            trainEnd += stepSize;
        }

        return Object.freeze(splits);
    },

    /**
     * Validate a forecast request
     */
    validateRequest(request: ForecastRequest): {
        valid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (!request.tenantId || typeof request.tenantId !== "string") {
            errors.push("tenantId is required");
        }
        if (!request.metricName || typeof request.metricName !== "string") {
            errors.push("metricName is required");
        }
        if (!request.trainingStart || !isValidISODate(request.trainingStart)) {
            errors.push("trainingStart must be a valid ISO date");
        }
        if (!request.trainingEnd || !isValidISODate(request.trainingEnd)) {
            errors.push("trainingEnd must be a valid ISO date");
        }
        if (request.trainingStart && request.trainingEnd) {
            const startTime = new Date(request.trainingStart).getTime();
            const endTime = new Date(request.trainingEnd).getTime();
            if (startTime >= endTime) {
                errors.push("trainingStart must be before trainingEnd");
            }
        }
        if (typeof request.horizon !== "number" || request.horizon <= 0 || !Number.isInteger(request.horizon)) {
            errors.push("horizon must be a positive integer");
        }
        if (request.method === "seasonal_naive") {
            if (!request.seasonalPeriod || request.seasonalPeriod <= 0 || !Number.isInteger(request.seasonalPeriod)) {
                errors.push("seasonal_naive requires positive integer seasonalPeriod");
            }
        }
        if (request.method === "moving_average") {
            if (!request.movingAverageWindow || request.movingAverageWindow <= 0 || !Number.isInteger(request.movingAverageWindow)) {
                errors.push("moving_average requires positive integer movingAverageWindow");
            }
        }
        if (request.method === "exponential_smoothing") {
            if (request.exponentialSmoothingAlpha === undefined ||
                request.exponentialSmoothingAlpha < 0 ||
                request.exponentialSmoothingAlpha > 1) {
                errors.push("exponential_smoothing requires exponentialSmoothingAlpha in [0, 1]");
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
};

/**
 * Deduplicate observations by timestamp (last-write-wins based on recordedAt)
 */
function deduplicateObservations(observations: readonly MetricObservation[]): MetricObservation[] {
    const map = new Map<string, MetricObservation>();

    for (const obs of observations) {
        const existing = map.get(obs.timestamp);
        if (!existing) {
            map.set(obs.timestamp, obs);
        } else {
            // Last-write-wins
            if (new Date(obs.recordedAt).getTime() > new Date(existing.recordedAt).getTime()) {
                map.set(obs.timestamp, obs);
            }
        }
    }

    return [...map.values()].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
}

/**
 * Detect the most common interval (mode)
 */
function detectIntervalMode(intervals: readonly number[]): number | null {
    if (intervals.length === 0) {
        return null;
    }

    const counts = new Map<number, number>();
    for (const interval of intervals) {
        const rounded = Math.round(interval * 1000) / 1000;
        counts.set(rounded, (counts.get(rounded) || 0) + 1);
    }

    let maxCount = 0;
    let mode: number | null = null;
    for (const [interval, count] of counts) {
        if (count > maxCount) {
            maxCount = count;
            mode = interval;
        }
    }

    return mode;
}

/**
 * Check if intervals are irregular
 * Irregular if any interval differs from mode by more than 1%
 */
function isIntervalIrregular(intervals: readonly number[], mode: number | null): boolean {
    if (mode === null || intervals.length === 0) {
        return false;
    }

    const tolerance = 0.01; // 1%
    for (const interval of intervals) {
        if (Math.abs(interval - mode) > mode * tolerance) {
            return true;
        }
    }

    return false;
}

/**
 * Check if a string is a valid ISO date
 */
function isValidISODate(s: string): boolean {
    if (typeof s !== "string") return false;
    const d = new Date(s);
    return !isNaN(d.getTime());
}
