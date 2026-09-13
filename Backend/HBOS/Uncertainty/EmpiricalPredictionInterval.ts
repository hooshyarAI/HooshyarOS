/**
 * Stage 07-D.B - Empirical Prediction Intervals
 *
 * Computes empirical prediction intervals using residual quantiles.
 *
 * METHOD:
 * - For requested coverage C:
 *   alpha = 1 - C
 *   q_lower = alpha / 2  (e.g., 0.025 for 95%)
 *   q_upper = 1 - alpha / 2  (e.g., 0.975 for 95%)
 * - For point forecast y_hat:
 *   lower = y_hat + quantile(residuals, q_lower)
 *   upper = y_hat + quantile(residuals, q_upper)
 *
 * IMPORTANT:
 * - Reuses canonical Stage 07-A Type-7 percentile (Hyndman & Fan)
 *   rank = p * (n - 1) with linear interpolation
 * - Does NOT assume residuals are normally distributed
 * - Does NOT fabricate Gaussian confidence intervals
 * - Does NOT call std-multiplier a "prediction interval"
 * - Does NOT inspect future data outside the residual calibration set
 * - Asymmetric residual distributions are preserved (no forced symmetry)
 * - All outputs are deterministic for identical inputs
 */

import { DescriptiveStatistics } from "../Temporal/DescriptiveStatistics";
import {
    ResidualSet,
    UncertaintyMethod,
    UncertaintyStatus,
    ForecastUncertainty,
    PredictionInterval,
    CalibrationEvidence,
    UncertaintyProvenance
} from "./UncertaintyTypes";

/**
 * Input for computing a single empirical prediction interval
 */
export interface EmpiricalIntervalInput {
    /** Tenant ID for isolation/provenance */
    readonly tenantId: string;
    /** Metric name for provenance */
    readonly metricName: string;
    /** Forecasting method for provenance */
    readonly forecastingMethod: string;
    /** Forecast timestamp (ISO date string) */
    readonly forecastTimestamp: string;
    /** Step number (1-based) within the forecast horizon */
    readonly step: number;
    /** Point forecast value (must be finite) */
    readonly pointForecast: number;
    /** Coverage level, strictly between 0 and 1 (e.g., 0.95) */
    readonly coverage: number;
    /** Residual set from the calibration backtest */
    readonly residualSet: ResidualSet;
}

/**
 * Quantile provenance - explicit evidence for reproduction
 */
export interface QuantileProvenance {
    /** Quantile convention used (Hyndman & Fan Type 7) */
    readonly percentileConvention: "hyndman_fan_type7";
    /** Lower quantile position (alpha/2) */
    readonly qLowerPosition: number;
    /** Upper quantile position (1 - alpha/2) */
    readonly qUpperPosition: number;
    /** Quantile value at qLower */
    readonly qLower: number;
    /** Quantile value at qUpper */
    readonly qUpper: number;
    /** Number of residuals used */
    readonly residualCount: number;
    /** Sum of residuals (for sanity checks) */
    readonly residualSum: number;
    /** Whether residuals are finite */
    readonly allResidualsFinite: boolean;
    /** Whether residuals are chronologically ordered */
    readonly chronologicalIntegrity: boolean;
}

/**
 * Result type for empirical prediction interval calculation
 */
export type EmpiricalIntervalResult =
    | {
          readonly status: "calculated";
          readonly interval: PredictionInterval;
          readonly quantileProvenance: QuantileProvenance;
          readonly method: UncertaintyMethod;
          readonly coverage: number;
          readonly alpha: number;
          readonly residualCount: number;
          readonly forecastingMethod: string;
          readonly tenantId: string;
          readonly metricName: string;
          readonly uncertaintyProvenance: UncertaintyProvenance;
          readonly calibration: CalibrationEvidence;
      }
    | {
          readonly status: "insufficient_data" | "invalid_request" | "model_error" | "unavailable";
          readonly error: string;
          readonly tenantId: string;
          readonly metricName: string;
          readonly forecastingMethod: string;
          readonly coverage: number;
          readonly residualCount: number;
      };

/**
 * Minimum number of residuals required to compute an empirical interval.
 * 3 is the absolute minimum needed for non-degenerate asymmetric quantiles.
 * 30+ is recommended for stable estimation, but the contract only enforces
 * that quantiles are well-defined, not that they're statistically reliable.
 * Statistical reliability is the consumer's responsibility (Stage 07-D.A's
 * CalibrationEvidence.isCalibrated reports that).
 */
const MIN_RESIDUALS_FOR_INTERVAL = 3;

/**
 * EmpiricalPredictionInterval - deterministic empirical quantile interval calculator
 */
export const EmpiricalPredictionInterval = {
    /**
     * Compute an empirical prediction interval for a single point forecast.
     */
    compute(input: EmpiricalIntervalInput): EmpiricalIntervalResult {
        // ===== Input validation =====
        if (!input) {
            return buildError("unavailable", "Input is undefined", "", "", "", 0, 0);
        }

        const {
            tenantId,
            metricName,
            forecastingMethod,
            forecastTimestamp,
            step,
            pointForecast,
            coverage,
            residualSet
        } = input;

        // Coverage must be strictly between 0 and 1
        if (typeof coverage !== "number" || !isFiniteValue(coverage) || coverage <= 0 || coverage >= 1) {
            return buildError(
                "invalid_request",
                `Coverage must be strictly between 0 and 1, got ${coverage}`,
                tenantId, metricName, forecastingMethod, coverage, 0
            );
        }

        // Point forecast must be finite
        if (typeof pointForecast !== "number" || !isFiniteValue(pointForecast)) {
            return buildError(
                "invalid_request",
                `Point forecast must be a finite number, got ${pointForecast}`,
                tenantId, metricName, forecastingMethod, coverage, residualSet?.observationCount ?? 0
            );
        }

        // Validate residual set presence
        if (!residualSet || !residualSet.residuals) {
            return buildError(
                "insufficient_data",
                "Residual set is missing or invalid",
                tenantId, metricName, forecastingMethod, coverage, 0
            );
        }

        const residualCount = residualSet.residuals.length;

        // Insufficient residual data
        if (residualCount < MIN_RESIDUALS_FOR_INTERVAL) {
            return buildError(
                "insufficient_data",
                `Need at least ${MIN_RESIDUALS_FOR_INTERVAL} residuals for empirical interval, got ${residualCount}`,
                tenantId, metricName, forecastingMethod, coverage, residualCount
            );
        }

        // Extract residual values
        const residualValues: number[] = [];
        let residualSum = 0;
        let allFinite = true;
        for (const r of residualSet.residuals) {
            if (!isFiniteValue(r.residual)) {
                allFinite = false;
                continue;
            }
            residualValues.push(r.residual);
            residualSum += r.residual;
        }

        if (residualValues.length < MIN_RESIDUALS_FOR_INTERVAL) {
            return buildError(
                "insufficient_data",
                `Need at least ${MIN_RESIDUALS_FOR_INTERVAL} finite residuals, got ${residualValues.length}`,
                tenantId, metricName, forecastingMethod, coverage, residualValues.length
            );
        }

        // Verify chronological integrity (defensive)
        const chronological = verifyChronologicalOrder(residualSet.residuals);

        // ===== Compute quantiles =====
        const alpha = 1 - coverage;
        const qLowerPosition = alpha / 2;
        const qUpperPosition = 1 - alpha / 2;

        // Reuse canonical Stage 07-A Type-7 percentile
        const qLower = DescriptiveStatistics.percentile(residualValues, qLowerPosition);
        const qUpper = DescriptiveStatistics.percentile(residualValues, qUpperPosition);

        if (!isFiniteValue(qLower) || !isFiniteValue(qUpper)) {
            return buildError(
                "model_error",
                `Quantile computation returned non-finite values: qLower=${qLower}, qUpper=${qUpper}`,
                tenantId, metricName, forecastingMethod, coverage, residualCount
            );
        }

        // ===== Construct interval =====
        const lowerBound = pointForecast + qLower;
        const upperBound = pointForecast + qUpper;

        // Guard: lower must be <= upper
        // For Type-7 quantiles, qLower <= qUpper by construction
        // (since p1 < p2 implies percentile(p1) <= percentile(p2) on sorted data)
        // but we add a defensive check for floating-point safety
        const safeLower = Math.min(lowerBound, upperBound);
        const safeUpper = Math.max(lowerBound, upperBound);

        const interval: PredictionInterval = Object.freeze({
            timestamp: forecastTimestamp,
            pointForecast,
            lowerBound: safeLower,
            upperBound: safeUpper,
            confidenceLevel: coverage,
            step
        });

        // ===== Build provenance/calibration evidence =====
        const quantileProvenance: QuantileProvenance = Object.freeze({
            percentileConvention: "hyndman_fan_type7",
            qLowerPosition,
            qUpperPosition,
            qLower,
            qUpper,
            residualCount: residualValues.length,
            residualSum,
            allResidualsFinite: allFinite,
            chronologicalIntegrity: chronological
        });

        // Calibration evidence (reuse Stage 07-D.A's mean/std for context)
        const meanResidual = residualSum / residualValues.length;
        const sqDiffs = residualValues.map(r => Math.pow(r - meanResidual, 2));
        const variance = sqDiffs.reduce((s, d) => s + d, 0) / (residualValues.length - 1);
        const residualStd = Math.sqrt(variance);
        const minResidual = Math.min(...residualValues);
        const maxResidual = Math.max(...residualValues);

        const calibration: CalibrationEvidence = Object.freeze({
            residualCount: residualValues.length,
            meanResidual,
            residualStd,
            minResidual,
            maxResidual,
            method: "quantile_empirical",
            isCalibrated: residualValues.length >= 30,
            minRequiredResiduals: 30
        });

        const uncertaintyProvenance: UncertaintyProvenance = Object.freeze({
            source: "empirical-prediction-interval",
            tenant: tenantId,
            metric: metricName,
            method: forecastingMethod,
            residualCount: residualValues.length,
            calculatedAt: "2026-01-01T00:00:00Z"
        });

        return Object.freeze({
            status: "calculated" as const,
            interval,
            quantileProvenance,
            method: "quantile_empirical" as UncertaintyMethod,
            coverage,
            alpha,
            residualCount: residualValues.length,
            forecastingMethod,
            tenantId,
            metricName,
            uncertaintyProvenance,
            calibration
        });
    },

    /**
     * Compute empirical prediction intervals for a full forecast horizon.
     *
     * Wraps the single-point calculator for each forecast point.
     */
    computeForHorizon(
        tenantId: string,
        metricName: string,
        forecastingMethod: string,
        pointForecasts: ReadonlyArray<{ readonly timestamp: string; readonly value: number }>,
        coverage: number,
        residualSet: ResidualSet
    ): ForecastUncertainty {
        if (!pointForecasts || pointForecasts.length === 0) {
            return buildForecastError(
                "insufficient_data",
                "No point forecasts provided",
                tenantId, metricName, forecastingMethod, coverage, 0
            );
        }

        const intervals: PredictionInterval[] = [];
        let lastError = "";
        let lastStatus: UncertaintyStatus = "calculated";

        for (let i = 0; i < pointForecasts.length; i++) {
            const pf = pointForecasts[i];
            const result = EmpiricalPredictionInterval.compute({
                tenantId,
                metricName,
                forecastingMethod,
                forecastTimestamp: pf.timestamp,
                step: i + 1,
                pointForecast: pf.value,
                coverage,
                residualSet
            });

            if (result.status === "calculated") {
                intervals.push(result.interval);
            } else {
                lastError = result.error;
                lastStatus = result.status;
                break;
            }
        }

        if (intervals.length === 0) {
            return buildForecastError(
                lastStatus,
                lastError || "Failed to compute any intervals",
                tenantId, metricName, forecastingMethod, coverage,
                residualSet?.observationCount ?? 0
            );
        }

        // If we couldn't compute all intervals, return what we have
        if (intervals.length < pointForecasts.length) {
            return buildForecastError(
                lastStatus,
                `Computed ${intervals.length}/${pointForecasts.length} intervals: ${lastError}`,
                tenantId, metricName, forecastingMethod, coverage,
                residualSet?.observationCount ?? 0
            );
        }

        // All intervals computed - aggregate evidence
        const firstResult = EmpiricalPredictionInterval.compute({
            tenantId,
            metricName,
            forecastingMethod,
            forecastTimestamp: pointForecasts[0].timestamp,
            step: 1,
            pointForecast: pointForecasts[0].value,
            coverage,
            residualSet
        });

        if (firstResult.status !== "calculated") {
            return buildForecastError(
                firstResult.status,
                firstResult.error,
                tenantId, metricName, forecastingMethod, coverage,
                residualSet?.observationCount ?? 0
            );
        }

        return Object.freeze({
            tenantId,
            metricName,
            method: forecastingMethod,
            horizon: intervals.length,
            residualCount: firstResult.residualCount,
            intervals: Object.freeze(intervals),
            uncertaintyMethod: "quantile_empirical" as UncertaintyMethod,
            confidenceLevel: coverage,
            calibration: firstResult.calibration,
            status: "calculated" as UncertaintyStatus,
            provenance: firstResult.uncertaintyProvenance
        });
    }
};

// ===== Helper functions =====

function isFiniteValue(v: number): boolean {
    return typeof v === "number" && Number.isFinite(v) && !isNaN(v);
}

function verifyChronologicalOrder(
    residuals: ReadonlyArray<{ readonly originTimestamp: string }>
): boolean {
    for (let i = 1; i < residuals.length; i++) {
        const prev = new Date(residuals[i - 1].originTimestamp).getTime();
        const curr = new Date(residuals[i].originTimestamp).getTime();
        if (prev > curr) {
            return false;
        }
    }
    return true;
}

function buildError(
    status: "insufficient_data" | "invalid_request" | "model_error" | "unavailable",
    message: string,
    tenantId: string,
    metricName: string,
    forecastingMethod: string,
    coverage: number,
    residualCount: number
): EmpiricalIntervalResult {
    return Object.freeze({
        status,
        error: message,
        tenantId,
        metricName,
        forecastingMethod,
        coverage,
        residualCount
    });
}

function buildForecastError(
    status: UncertaintyStatus,
    message: string,
    tenantId: string,
    metricName: string,
    method: string,
    coverage: number,
    residualCount: number
): ForecastUncertainty {
    return Object.freeze({
        tenantId,
        metricName,
        method,
        horizon: 0,
        residualCount,
        intervals: Object.freeze([]),
        uncertaintyMethod: "quantile_empirical",
        confidenceLevel: coverage,
        calibration: null,
        status,
        provenance: Object.freeze({
            source: "empirical-prediction-interval",
            tenant: tenantId,
            metric: metricName,
            method,
            residualCount,
            calculatedAt: "2026-01-01T00:00:00Z"
        }),
        error: message
    });
}
