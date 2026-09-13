/**
 * Stage 07-C.C - Forecast Metrics
 *
 * Deterministic forecast evaluation metrics.
 *
 * IMPORTANT:
 * - No fabricated uncertainty/confidence
 * - Explicit zero-denominator handling for MAPE/sMAPE
 * - Deterministic precision
 * - MASE only when scaling factor is explicitly available
 */

import { ForecastMetrics } from "./ForecastTypes";

/**
 * ForecastMetricsCalculator - Canonical forecast evaluation
 */
export const ForecastMetricsCalculator = {
    /**
     * Calculate all metrics for actual vs predicted values
     *
     * MAPE invalid samples (where actual=0) are excluded
     * sMAPE samples (where |y|+|yhat|=0) are excluded
     */
    calculate(actual: readonly number[], predicted: readonly number[]): ForecastMetrics {
        if (actual.length !== predicted.length) {
            throw new Error("Actual and predicted arrays must have the same length");
        }
        if (actual.length === 0) {
            return {
                mae: NaN,
                rmse: NaN,
                mape: null,
                smape: NaN,
                mase: null,
                n: 0
            };
        }

        const n = actual.length;

        // MAE: mean(|y - yhat|)
        const absErrors = actual.map((y, i) => Math.abs(y - predicted[i]));
        const mae = absErrors.reduce((sum, e) => sum + e, 0) / n;

        // RMSE: sqrt(mean((y - yhat)^2))
        const squaredErrors = actual.map((y, i) => Math.pow(y - predicted[i], 2));
        const mse = squaredErrors.reduce((sum, e) => sum + e, 0) / n;
        const rmse = Math.sqrt(mse);

        // MAPE: mean(|(y-yhat)/y|) * 100, excluding y=0
        const mapeSamples: number[] = [];
        for (let i = 0; i < n; i++) {
            if (actual[i] !== 0) {
                mapeSamples.push(Math.abs((actual[i] - predicted[i]) / actual[i]));
            }
        }
        const mape = mapeSamples.length > 0
            ? (mapeSamples.reduce((sum, m) => sum + m, 0) / mapeSamples.length) * 100
            : null;

        // sMAPE: mean(2|y-yhat|/(|y|+|yhat|)) * 100, excluding |y|+|yhat|=0
        const smapeSamples: number[] = [];
        for (let i = 0; i < n; i++) {
            const denom = Math.abs(actual[i]) + Math.abs(predicted[i]);
            if (denom > 0) {
                smapeSamples.push(2 * Math.abs(actual[i] - predicted[i]) / denom);
            }
        }
        const smape = smapeSamples.length > 0
            ? (smapeSamples.reduce((sum, s) => sum + s, 0) / smapeSamples.length) * 100
            : NaN;

        // MASE: mean(|y-yhat|) / scalingFactor
        // Not implemented unless scaling factor is provided separately
        const mase: number | null = null;

        return {
            mae,
            rmse,
            mape,
            smape,
            mase,
            n
        };
    },

    /**
     * Calculate MAE only
     */
    mae(actual: readonly number[], predicted: readonly number[]): number {
        if (actual.length === 0) return NaN;
        const sum = actual.reduce((acc, y, i) => acc + Math.abs(y - predicted[i]), 0);
        return sum / actual.length;
    },

    /**
     * Calculate RMSE only
     */
    rmse(actual: readonly number[], predicted: readonly number[]): number {
        if (actual.length === 0) return NaN;
        const sumSq = actual.reduce((acc, y, i) => acc + Math.pow(y - predicted[i], 2), 0);
        return Math.sqrt(sumSq / actual.length);
    },

    /**
     * Calculate MAPE only (returns null if all actuals are zero)
     */
    mape(actual: readonly number[], predicted: readonly number[]): number | null {
        const samples: number[] = [];
        for (let i = 0; i < actual.length; i++) {
            if (actual[i] !== 0) {
                samples.push(Math.abs((actual[i] - predicted[i]) / actual[i]));
            }
        }
        if (samples.length === 0) return null;
        return (samples.reduce((sum, m) => sum + m, 0) / samples.length) * 100;
    },

    /**
     * Calculate sMAPE only
     */
    smape(actual: readonly number[], predicted: readonly number[]): number {
        const samples: number[] = [];
        for (let i = 0; i < actual.length; i++) {
            const denom = Math.abs(actual[i]) + Math.abs(predicted[i]);
            if (denom > 0) {
                samples.push(2 * Math.abs(actual[i] - predicted[i]) / denom);
            }
        }
        if (samples.length === 0) return NaN;
        return (samples.reduce((sum, s) => sum + s, 0) / samples.length) * 100;
    },

    /**
     * Aggregate metrics from multiple splits
     */
    aggregate(metricsList: readonly ForecastMetrics[]): ForecastMetrics {
        const valid = metricsList.filter(m => !isNaN(m.mae) && m.n > 0);
        if (valid.length === 0) {
            return {
                mae: NaN,
                rmse: NaN,
                mape: null,
                smape: NaN,
                mase: null,
                n: 0
            };
        }

        const n = valid.reduce((sum, m) => sum + m.n, 0);

        // Weighted average by n
        const mae = valid.reduce((sum, m) => sum + m.mae * m.n, 0) / n;
        const rmseSquared = valid.reduce((sum, m) => sum + m.rmse * m.rmse * m.n, 0) / n;
        const rmse = Math.sqrt(rmseSquared);

        // MAPE aggregation (only from valid MAPE splits)
        const mapeValid = valid.filter(m => m.mape !== null);
        const mape = mapeValid.length > 0
            ? mapeValid.reduce((sum, m) => sum + (m.mape as number) * m.n, 0) / n
            : null;

        // sMAPE aggregation
        const smapeValid = valid.filter(m => !isNaN(m.smape));
        const smape = smapeValid.length > 0
            ? smapeValid.reduce((sum, m) => sum + m.smape * m.n, 0) / n
            : NaN;

        return {
            mae,
            rmse,
            mape,
            smape,
            mase: null,
            n
        };
    }
};
