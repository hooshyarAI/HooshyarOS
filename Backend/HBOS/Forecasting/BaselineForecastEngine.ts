/**
 * Stage 07-C.B - Baseline Forecast Engine
 *
 * Deterministic baseline forecasting methods:
 * - Naive
 * - Seasonal Naive
 * - Moving Average
 *
 * IMPORTANT:
 * - Reuses Stage 07-C.A contracts
 * - No fabricated confidence/uncertainty
 * - Explicit insufficient-data handling
 * - Deterministic results
 */

import {
    ForecastRequest,
    ForecastResult,
    ForecastPoint,
    ForecastEvidence,
    ForecastStatus,
    ForecastMethod
} from "./ForecastTypes";
import { PreparedTimeSeries } from "./ForecastTypes";
import { ForecastDataPreparation } from "./ForecastDataPreparation";
import { TimeSeriesStore } from "../Temporal/TimeSeriesStore";

/**
 * BaselineForecastEngine - Canonical baseline forecasting
 */
export const BaselineForecastEngine = {
    /**
     * Generate a forecast based on the request
     */
    async forecast(
        store: TimeSeriesStore,
        request: ForecastRequest
    ): Promise<ForecastResult> {
        // Validate request
        const validation = ForecastDataPreparation.validateRequest(request);
        if (!validation.valid) {
            return createErrorResult(
                request,
                "invalid_request",
                validation.errors.join("; ")
            );
        }

        // Prepare time series
        const series = await ForecastDataPreparation.prepare(store, request);
        if (!series) {
            return createErrorResult(
                request,
                "insufficient_data",
                "No valid observations found in training window"
            );
        }

        // Dispatch to appropriate method
        switch (request.method) {
            case "naive":
                return naiveForecast(series, request);
            case "seasonal_naive":
                return seasonalNaiveForecast(series, request);
            case "moving_average":
                return movingAverageForecast(series, request);
            case "exponential_smoothing":
                return exponentialSmoothingForecast(series, request);
            default:
                return createErrorResult(
                    request,
                    "invalid_request",
                    `Unsupported method: ${request.method}`
                );
        }
    },

    /**
     * Generate forecast from a pre-prepared series
     * (Useful for backtesting and tests)
     */
    forecastFromSeries(
        series: PreparedTimeSeries,
        request: ForecastRequest
    ): ForecastResult {
        // Validate request
        const validation = ForecastDataPreparation.validateRequest(request);
        if (!validation.valid) {
            return createErrorResult(
                request,
                "invalid_request",
                validation.errors.join("; ")
            );
        }

        // Dispatch to appropriate method
        switch (request.method) {
            case "naive":
                return naiveForecast(series, request);
            case "seasonal_naive":
                return seasonalNaiveForecast(series, request);
            case "moving_average":
                return movingAverageForecast(series, request);
            case "exponential_smoothing":
                return exponentialSmoothingForecast(series, request);
            default:
                return createErrorResult(
                    request,
                    "invalid_request",
                    `Unsupported method: ${request.method}`
                );
        }
    }
};

// ===== NAIVE FORECAST =====

/**
 * Naive forecast: forecast(t+h) = last observed value
 */
function naiveForecast(
    series: PreparedTimeSeries,
    request: ForecastRequest
): ForecastResult {
    if (series.observations.length === 0) {
        return createErrorResult(request, "insufficient_data", "Empty series");
    }

    const lastObs = series.observations[series.observations.length - 1];
    const lastTime = new Date(lastObs.timestamp).getTime();
    const intervalDays = series.intervalMode || 1; // assume daily if unknown
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;

    const points: ForecastPoint[] = [];
    for (let h = 1; h <= request.horizon; h++) {
        const forecastTime = new Date(lastTime + h * intervalMs).toISOString();
        points.push({
            timestamp: forecastTime,
            predictedValue: lastObs.value,
            step: h
        });
    }

    return createSuccessResult(request, series.observations.length, points, {
        lastValue: lastObs.value,
        lastTimestamp: lastObs.timestamp
    });
}

// ===== SEASONAL NAIVE FORECAST =====

/**
 * Seasonal Naive: forecast(t+h) = value from same season ago (h periods back)
 */
function seasonalNaiveForecast(
    series: PreparedTimeSeries,
    request: ForecastRequest
): ForecastResult {
    const seasonalPeriod = request.seasonalPeriod!;

    if (series.observations.length === 0) {
        return createErrorResult(request, "insufficient_data", "Empty series");
    }

    // Need at least seasonalPeriod observations
    if (series.observations.length < seasonalPeriod) {
        return createErrorResult(
            request,
            "insufficient_data",
            `Seasonal naive requires at least ${seasonalPeriod} observations, got ${series.observations.length}`
        );
    }

    const lastTime = new Date(series.observations[series.observations.length - 1].timestamp).getTime();
    const intervalDays = series.intervalMode || 1;
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;

    const points: ForecastPoint[] = [];
    for (let h = 1; h <= request.horizon; h++) {
        // For step h, use observation at index (n - seasonalPeriod + ((h-1) % seasonalPeriod))
        const seasonalIndex = series.observations.length - seasonalPeriod + ((h - 1) % seasonalPeriod);
        const seasonalValue = series.observations[seasonalIndex].value;

        const forecastTime = new Date(lastTime + h * intervalMs).toISOString();
        points.push({
            timestamp: forecastTime,
            predictedValue: seasonalValue,
            step: h
        });
    }

    return createSuccessResult(request, series.observations.length, points, {
        seasonalPeriod,
        seasonalIndexUsed: series.observations.length - seasonalPeriod
    });
}

// ===== MOVING AVERAGE FORECAST =====

/**
 * Moving Average forecast:
 * - First forecast = mean of last `window` observations
 * - Subsequent forecasts update by adding the previous forecast
 *   and dropping the oldest observation (rolling)
 */
function movingAverageForecast(
    series: PreparedTimeSeries,
    request: ForecastRequest
): ForecastResult {
    const window = request.movingAverageWindow!;

    if (series.observations.length === 0) {
        return createErrorResult(request, "insufficient_data", "Empty series");
    }

    if (series.observations.length < window) {
        return createErrorResult(
            request,
            "insufficient_data",
            `Moving average requires at least ${window} observations, got ${series.observations.length}`
        );
    }

    const lastTime = new Date(series.observations[series.observations.length - 1].timestamp).getTime();
    const intervalDays = series.intervalMode || 1;
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;

    // Initialize the rolling window with the last `window` observations
    const rollingWindow: number[] = series.observations
        .slice(series.observations.length - window)
        .map(o => o.value);

    const points: ForecastPoint[] = [];
    for (let h = 1; h <= request.horizon; h++) {
        // Calculate mean of current window
        const sum = rollingWindow.reduce((acc, v) => acc + v, 0);
        const mean = sum / rollingWindow.length;

        // Add forecast point
        const forecastTime = new Date(lastTime + h * intervalMs).toISOString();
        points.push({
            timestamp: forecastTime,
            predictedValue: mean,
            step: h
        });

        // Advance the rolling window: drop oldest, add forecast
        rollingWindow.shift();
        rollingWindow.push(mean);
    }

    return createSuccessResult(request, series.observations.length, points, {
        window,
        initialWindowValues: series.observations
            .slice(series.observations.length - window)
            .map(o => o.value)
    });
}

// ===== EXPONENTIAL SMOOTHING =====

/**
 * Exponential Smoothing (Simple)
 * level_t = alpha * y_t + (1 - alpha) * level_{t-1}
 * forecast(t+h) = level_t
 */
function exponentialSmoothingForecast(
    series: PreparedTimeSeries,
    request: ForecastRequest
): ForecastResult {
    const alpha = request.exponentialSmoothingAlpha!;

    if (series.observations.length === 0) {
        return createErrorResult(request, "insufficient_data", "Empty series");
    }

    // Initialize level with first observation
    let level = series.observations[0].value;

    // Update level for each observation
    for (let i = 1; i < series.observations.length; i++) {
        level = alpha * series.observations[i].value + (1 - alpha) * level;
    }

    const lastTime = new Date(series.observations[series.observations.length - 1].timestamp).getTime();
    const intervalDays = series.intervalMode || 1;
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;

    const points: ForecastPoint[] = [];
    for (let h = 1; h <= request.horizon; h++) {
        // For simple exponential smoothing, forecast is constant = level
        const forecastTime = new Date(lastTime + h * intervalMs).toISOString();
        points.push({
            timestamp: forecastTime,
            predictedValue: level,
            step: h
        });
    }

    return createSuccessResult(request, series.observations.length, points, {
        alpha,
        finalLevel: level
    });
}

// ===== HELPERS =====

/**
 * Create a successful forecast result
 */
function createSuccessResult(
    request: ForecastRequest,
    observationCount: number,
    points: ForecastPoint[],
    config: Record<string, unknown>
): ForecastResult {
    const evidence: ForecastEvidence = {
        method: request.method,
        tenantId: request.tenantId,
        metricName: request.metricName,
        trainingWindow: {
            start: request.trainingStart,
            end: request.trainingEnd
        },
        horizon: request.horizon,
        observationCount,
        modelId: `${request.method}-${observationCount}-${request.horizon}`,
        calculatedAt: "2026-01-01T00:00:00Z", // Deterministic timestamp
        confidence: {
            source: "unavailable" as const
        }
    };

    return {
        status: "success",
        tenantId: request.tenantId,
        metricName: request.metricName,
        horizon: request.horizon,
        method: request.method,
        points: Object.freeze([...points]),
        observationCount,
        evidence: Object.freeze(evidence)
    };
}

/**
 * Create an error forecast result
 */
function createErrorResult(
    request: ForecastRequest,
    status: ForecastStatus,
    error: string
): ForecastResult {
    return {
        status,
        tenantId: request.tenantId,
        metricName: request.metricName,
        horizon: request.horizon,
        method: request.method,
        points: Object.freeze([]),
        observationCount: 0,
        evidence: Object.freeze({
            method: request.method,
            tenantId: request.tenantId,
            metricName: request.metricName,
            trainingWindow: {
                start: request.trainingStart,
                end: request.trainingEnd
            },
            horizon: request.horizon,
            observationCount: 0,
            modelId: "error",
            calculatedAt: "2026-01-01T00:00:00Z",
            confidence: {
                source: "unavailable" as const
            }
        } as ForecastEvidence),
        error
    };
}
