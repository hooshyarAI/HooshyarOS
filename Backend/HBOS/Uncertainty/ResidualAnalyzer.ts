/**
 * Stage 07-D.A - Residual Analyzer
 *
 * Deterministic extraction of forecast residuals from backtest results.
 *
 * IMPORTANT:
 * - Uses existing BacktestEngine results
 * - Rejects NaN/Infinity silently (no coercion)
 * - Preserves chronological ordering
 * - No future leakage (uses training-only predictions)
 * - Deterministic
 */

import { BacktestResult, BacktestSplit } from "../Forecasting/BacktestTypes";
import { ResidualObservation, ResidualSet, ResidualProvenance } from "./UncertaintyTypes";

/**
 * ResidualAnalyzer - Canonical residual extraction
 */
export const ResidualAnalyzer = {
    /**
     * Extract residuals from a backtest result
     *
     * Returns null if backtest is invalid or has no splits
     */
    extractFromBacktest(backtest: BacktestResult): ResidualSet | null {
        if (backtest.status !== "success") {
            return null;
        }
        if (backtest.splits.length === 0) {
            return null;
        }
        if (!backtest.leakageStatus.allSplitsHaveNoLeakage) {
            return null;
        }

        const residuals: ResidualObservation[] = [];
        let finiteCount = 0;

        for (const split of backtest.splits) {
            // Align predictions with actuals by step
            const minLen = Math.min(split.predictions.length, split.actuals.length);
            for (let i = 0; i < minLen; i++) {
                const actual = split.actuals[i].actualValue;
                const prediction = split.predictions[i].predictedValue;

                // Reject non-finite values silently (no coercion)
                if (!isFiniteValue(actual) || !isFiniteValue(prediction)) {
                    continue;
                }

                const residual = actual - prediction;
                if (!isFiniteValue(residual)) {
                    continue;
                }
                finiteCount++;

                residuals.push({
                    tenantId: backtest.tenantId,
                    metricName: backtest.metricName,
                    forecastingMethod: backtest.method,
                    originTimestamp: split.trainingWindow.end,
                    forecastTimestamp: split.actuals[i].timestamp,
                    actual,
                    prediction,
                    residual,
                    splitIndex: split.splitIndex,
                    step: i + 1
                });
            }
        }

        // Sort chronologically by origin then by step
        residuals.sort((a, b) => {
            const aOrigin = new Date(a.originTimestamp).getTime();
            const bOrigin = new Date(b.originTimestamp).getTime();
            if (aOrigin !== bOrigin) {
                return aOrigin - bOrigin;
            }
            return a.step - b.step;
        });

        const provenance: ResidualProvenance = {
            source: "residual-analyzer",
            tenant: backtest.tenantId,
            metric: backtest.metricName,
            method: backtest.method,
            backtestSplitCount: backtest.splits.length,
            extractedAt: "2026-01-01T00:00:00Z"
        };

        return Object.freeze({
            tenantId: backtest.tenantId,
            metricName: backtest.metricName,
            method: backtest.method,
            observationCount: residuals.length,
            finiteResidualCount: finiteCount,
            residuals: Object.freeze(residuals),
            provenance: Object.freeze(provenance)
        });
    },

    /**
     * Validate a residual set
     */
    validate(residualSet: ResidualSet): {
        valid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (residualSet.observationCount === 0) {
            errors.push("Residual set is empty");
        }
        if (residualSet.observationCount !== residualSet.finiteResidualCount) {
            errors.push(`Non-finite residuals present: ${residualSet.observationCount - residualSet.finiteResidualCount}`);
        }

        // Verify chronological ordering
        for (let i = 1; i < residualSet.residuals.length; i++) {
            const prev = residualSet.residuals[i - 1];
            const curr = residualSet.residuals[i];
            const prevTime = new Date(prev.originTimestamp).getTime();
            const currTime = new Date(curr.originTimestamp).getTime();
            if (prevTime > currTime) {
                errors.push("Residuals are not in chronological order");
                break;
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    },

    /**
     * Compute calibration evidence from a residual set
     * (Does NOT compute prediction intervals - that's a future stage)
     */
    computeCalibration(residualSet: ResidualSet): {
        meanResidual: number;
        residualStd: number;
        minResidual: number;
        maxResidual: number;
        isCalibrated: boolean;
        minRequiredResiduals: number;
    } {
        const MIN_REQUIRED = 30; // Central limit theorem threshold

        if (residualSet.residuals.length === 0) {
            return {
                meanResidual: NaN,
                residualStd: NaN,
                minResidual: NaN,
                maxResidual: NaN,
                isCalibrated: false,
                minRequiredResiduals: MIN_REQUIRED
            };
        }

        const residuals = residualSet.residuals.map(r => r.residual);
        const n = residuals.length;

        // Mean
        const meanResidual = residuals.reduce((sum, r) => sum + r, 0) / n;

        // Standard deviation (sample std with Bessel's correction)
        const squaredDiffs = residuals.map(r => Math.pow(r - meanResidual, 2));
        const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / (n - 1);
        const residualStd = Math.sqrt(variance);

        // Min/Max
        const minResidual = Math.min(...residuals);
        const maxResidual = Math.max(...residuals);

        return {
            meanResidual,
            residualStd,
            minResidual,
            maxResidual,
            isCalibrated: n >= MIN_REQUIRED,
            minRequiredResiduals: MIN_REQUIRED
        };
    }
};

/**
 * Check if a value is finite
 */
function isFiniteValue(v: number): boolean {
    return typeof v === "number" && Number.isFinite(v) && !isNaN(v);
}
