/**
 * Stage 07-C.C - Backtest Engine
 *
 * Walk-forward / rolling-origin backtesting for time-series forecasts.
 *
 * IMPORTANT:
 * - No future leakage: training data is strictly before validation data
 * - Deterministic split ordering
 * - Tenant isolation enforced
 * - No fabricated uncertainty
 */

import { TimeSeriesStore } from "../Temporal/TimeSeriesStore";
import { ForecastDataPreparation } from "./ForecastDataPreparation";
import { BaselineForecastEngine } from "./BaselineForecastEngine";
import { ForecastMetricsCalculator } from "./ForecastMetrics";
import { PreparedTimeSeries, ForecastRequest, ForecastResult, ForecastPoint } from "./ForecastTypes";
import {
    BacktestConfig,
    BacktestResult,
    BacktestSplit,
    BacktestProvenance
} from "./BacktestTypes";

/**
 * BacktestEngine - Walk-forward backtesting
 */
export const BacktestEngine = {
    /**
     * Run walk-forward backtest using TimeSeriesStore
     */
    async run(store: TimeSeriesStore, config: BacktestConfig): Promise<BacktestResult> {
        // Prepare time series from store
        const series = await ForecastDataPreparation.prepare(store, {
            tenantId: config.tenantId,
            metricName: config.metricName,
            trainingStart: config.startTime,
            trainingEnd: config.endTime,
            horizon: config.validationSize,
            method: config.method,
            seasonalPeriod: config.seasonalPeriod,
            movingAverageWindow: config.movingAverageWindow,
            exponentialSmoothingAlpha: config.exponentialSmoothingAlpha
        });

        if (!series) {
            return createErrorResult(config, "insufficient_data", "No valid observations in backtest window");
        }

        return this.runFromSeries(series, config);
    },

    /**
     * Run walk-forward backtest from a pre-prepared series
     */
    runFromSeries(series: PreparedTimeSeries, config: BacktestConfig): BacktestResult {
        // Validate config
        const validation = validateBacktestConfig(config, series);
        if (!validation.valid) {
            return createErrorResult(config, "invalid_request", validation.error);
        }

        const stepSize = config.stepSize || 1;
        const splits: BacktestSplit[] = [];
        const allNoLeakage: boolean[] = [];

        // Create rolling-origin splits
        const rollingSplits = ForecastDataPreparation.createRollingOriginSplits(
            series,
            config.initialTrainingSize,
            config.validationSize,
            stepSize
        );

        // Run forecast + evaluate for each split
        for (let i = 0; i < rollingSplits.length; i++) {
            const split = rollingSplits[i];

            // Build a PreparedTimeSeries-like object from the training data
            const trainingSeries: PreparedTimeSeries = {
                tenantId: series.tenantId,
                metricName: series.metricName,
                observations: split.training,
                duplicatesRemoved: 0,
                nonFiniteRejected: 0,
                intervals: series.intervals.slice(0, split.training.length - 1),
                intervalMode: series.intervalMode,
                isIrregular: series.isIrregular,
                firstTimestamp: split.training[0]?.timestamp || "",
                lastTimestamp: split.training[split.training.length - 1]?.timestamp || ""
            };

            // Run forecast using only training data
            const request: ForecastRequest = {
                tenantId: config.tenantId,
                metricName: config.metricName,
                trainingStart: config.startTime,
                trainingEnd: config.endTime,
                horizon: config.validationSize,
                method: config.method,
                seasonalPeriod: config.seasonalPeriod,
                movingAverageWindow: config.movingAverageWindow,
                exponentialSmoothingAlpha: config.exponentialSmoothingAlpha
            };

            const forecastResult = BaselineForecastEngine.forecastFromSeries(trainingSeries, request);

            // Extract predictions and actuals
            const predictions = forecastResult.points.map(p => ({
                timestamp: p.timestamp,
                predictedValue: p.predictedValue
            }));

            const actuals = split.validation.map(v => ({
                timestamp: v.timestamp,
                actualValue: v.value
            }));

            // Align predictions with actuals by step
            const alignedActual: number[] = [];
            const alignedPredicted: number[] = [];
            for (let j = 0; j < Math.min(predictions.length, actuals.length); j++) {
                alignedActual.push(actuals[j].actualValue);
                alignedPredicted.push(predictions[j].predictedValue);
            }

            // Calculate metrics
            const splitMetrics = ForecastMetricsCalculator.calculate(alignedActual, alignedPredicted);

            // Leakage check
            const trainingMaxTimestamp = split.training[split.training.length - 1]?.timestamp || "";
            const validationMinTimestamp = split.validation[0]?.timestamp || "";
            const noLeakage = new Date(trainingMaxTimestamp).getTime() < new Date(validationMinTimestamp).getTime();
            allNoLeakage.push(noLeakage);

            splits.push({
                splitIndex: i,
                trainingWindow: {
                    start: split.training[0]?.timestamp || "",
                    end: trainingMaxTimestamp
                },
                validationWindow: {
                    start: validationMinTimestamp,
                    end: split.validation[split.validation.length - 1]?.timestamp || ""
                },
                trainingCount: split.training.length,
                validationCount: split.validation.length,
                predictions: Object.freeze([...predictions]),
                actuals: Object.freeze([...actuals]),
                metrics: {
                    mae: splitMetrics.mae,
                    rmse: splitMetrics.rmse,
                    mape: splitMetrics.mape,
                    smape: splitMetrics.smape,
                    n: splitMetrics.n
                },
                leakageCheck: {
                    trainingMaxTimestamp,
                    validationMinTimestamp,
                    noLeakage
                }
            });
        }

        // Aggregate metrics across all splits
        const aggregateMetrics = ForecastMetricsCalculator.aggregate(
            splits.map(s => s.metrics as any)
        );

        const allNoLeakageVerified = allNoLeakage.every(v => v);

        const provenance: BacktestProvenance = {
            source: "backtest-engine",
            tenant: config.tenantId,
            metric: config.metricName,
            method: config.method,
            overallWindow: {
                start: config.startTime,
                end: config.endTime
            },
            totalObservations: series.observations.length,
            numberOfSplits: splits.length,
            forecastHorizon: config.validationSize,
            metricDefinitions: {
                mae: "mean(|y - yhat|)",
                rmse: "sqrt(mean((y - yhat)^2))",
                mape: "mean(|(y-yhat)/y|) * 100, excluding y=0",
                smape: "mean(2|y-yhat|/(|y|+|yhat|)) * 100, excluding zero denominators"
            },
            calculatedAt: "2026-01-01T00:00:00Z"
        };

        return {
            status: "success",
            tenantId: config.tenantId,
            metricName: config.metricName,
            method: config.method,
            numberOfSplits: splits.length,
            forecastHorizon: config.validationSize,
            splits: Object.freeze(splits),
            aggregateMetrics: {
                mae: aggregateMetrics.mae,
                rmse: aggregateMetrics.rmse,
                mape: aggregateMetrics.mape,
                smape: aggregateMetrics.smape,
                n: aggregateMetrics.n
            },
            overallWindow: {
                start: config.startTime,
                end: config.endTime
            },
            provenance: Object.freeze(provenance),
            leakageStatus: {
                verified: allNoLeakageVerified,
                allSplitsHaveNoLeakage: allNoLeakageVerified,
                checkedAt: "2026-01-01T00:00:00Z"
            }
        };
    }
};

/**
 * Validate backtest configuration
 */
function validateBacktestConfig(
    config: BacktestConfig,
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
            error: `initialTrainingSize + validationSize (${config.initialTrainingSize + config.validationSize}) > total observations (${series.observations.length})`
        };
    }
    return { valid: true, error: "" };
}

/**
 * Create an error backtest result
 */
function createErrorResult(
    config: BacktestConfig,
    status: "insufficient_data" | "invalid_request",
    error: string
): BacktestResult {
    return {
        status,
        tenantId: config.tenantId,
        metricName: config.metricName,
        method: config.method,
        numberOfSplits: 0,
        forecastHorizon: config.validationSize,
        splits: Object.freeze([]),
        aggregateMetrics: {
            mae: NaN,
            rmse: NaN,
            mape: null,
            smape: NaN,
            n: 0
        },
        overallWindow: {
            start: config.startTime,
            end: config.endTime
        },
        provenance: {
            source: "backtest-engine",
            tenant: config.tenantId,
            metric: config.metricName,
            method: config.method,
            overallWindow: {
                start: config.startTime,
                end: config.endTime
            },
            totalObservations: 0,
            numberOfSplits: 0,
            forecastHorizon: config.validationSize,
            metricDefinitions: {
                mae: "mean(|y - yhat|)",
                rmse: "sqrt(mean((y - yhat)^2))",
                mape: "mean(|(y-yhat)/y|) * 100, excluding y=0",
                smape: "mean(2|y-yhat|/(|y|+|yhat|)) * 100, excluding zero denominators"
            },
            calculatedAt: "2026-01-01T00:00:00Z"
        },
        leakageStatus: {
            verified: false,
            allSplitsHaveNoLeakage: false,
            checkedAt: "2026-01-01T00:00:00Z"
        },
        error
    };
}
