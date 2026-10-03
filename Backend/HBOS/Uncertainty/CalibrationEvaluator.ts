/**
 * Stage 07-D.C - Prediction Interval Coverage & Calibration
 *
 * Evaluates empirical prediction intervals produced by Stage 07-D.B
 * against walk-forward backtest actuals.
 *
 * IMPORTANT:
 * - Walk-forward calibration: interval for split[i] is built from
 *   residuals of splits[0..i-1] (no future leakage).
 * - First split cannot be evaluated (no prior residuals).
 * - Non-finite values are NOT silently coerced - they are
 *   explicitly excluded with evidence recorded in provenance.
 * - Tenant isolation enforced.
 * - Deterministic: identical inputs produce identical results.
 * - Calibration classification uses documented thresholds.
 */

import { BacktestResult, BacktestSplit } from "../Forecasting/BacktestTypes";
import { ResidualSet, ResidualObservation } from "./UncertaintyTypes";
import { ResidualAnalyzer } from "./ResidualAnalyzer";
import { EmpiricalPredictionInterval } from "./EmpiricalPredictionInterval";

/**
 * Calibration status - explicit states
 */
export type CalibrationStatus =
    | "calibrated"
    | "under-covered"
    | "over-covered"
    | "insufficient_data"
    | "unavailable"
    | "invalid_request";

/**
 * Per-level coverage evaluation
 */
export interface CoverageLevelResult {
    /** Requested coverage level (e.g., 0.95) */
    readonly requestedCoverage: number;
    /** Empirical coverage rate from evaluated predictions */
    readonly empiricalCoverage: number;
    /** Number of predictions evaluated */
    readonly numberEvaluated: number;
    /** Number of predictions where actual was within interval */
    readonly numberCovered: number;
    /** Number of predictions where actual fell outside interval */
    readonly numberMissed: number;
    /** Empirical coverage minus requested (negative = under-covered) */
    readonly coverageError: number;
    /** Average interval width */
    readonly averageWidth: number;
    /** Median interval width */
    readonly medianWidth: number;
    /** Min interval width */
    readonly minWidth: number;
    /** Max interval width */
    readonly maxWidth: number;
    /** Calibration status */
    readonly status: CalibrationStatus;
    /** Calibration rule used (human-readable) */
    readonly calibrationRule: string;
    /** Number of finite predictions (excludes NaN/Infinity) */
    readonly numberFiniteEvaluated: number;
    /** Number of predictions excluded due to non-finite values */
    readonly numberExcludedNonFinite: number;
    /** Number of predictions excluded due to insufficient prior residuals */
    readonly numberExcludedInsufficientHistory: number;
}

/**
 * Horizon-specific coverage breakdown
 */
export interface HorizonCoverage {
    /** Horizon step (1-based) */
    readonly step: number;
    /** Coverage at this horizon */
    readonly coverage: number;
    /** Number of predictions evaluated at this horizon */
    readonly numberEvaluated: number;
    /** Number covered at this horizon */
    readonly numberCovered: number;
    /** Average interval width at this horizon */
    readonly averageWidth: number;
}

/**
 * Calibration report for a single coverage level
 */
export interface CalibrationReport {
    /** Tenant ID (scoped) */
    readonly tenantId: string;
    /** Metric name */
    readonly metricName: string;
    /** Forecasting method */
    readonly method: string;
    /** Requested coverage level */
    readonly requestedCoverage: number;
    /** Empirical coverage achieved */
    readonly empiricalCoverage: number;
    /** Number of predictions evaluated */
    readonly numberEvaluated: number;
    /** Number covered */
    readonly numberCovered: number;
    /** Number missed */
    readonly numberMissed: number;
    /** Coverage error */
    readonly coverageError: number;
    /** Average interval width */
    readonly averageWidth: number;
    /** Median interval width */
    readonly medianWidth: number;
    /** Min interval width */
    readonly minWidth: number;
    /** Max interval width */
    readonly maxWidth: number;
    /** Calibration status */
    readonly status: CalibrationStatus;
    /** Calibration rule */
    readonly calibrationRule: string;
    /** Sample size for claim */
    readonly minRequiredEvaluated: number;
    /** Per-horizon breakdown */
    readonly horizonBreakdown: ReadonlyArray<HorizonCoverage>;
    /** Per-split origin coverage */
    readonly perOriginCoverage: ReadonlyArray<{
        readonly splitIndex: number;
        readonly numberEvaluated: number;
        readonly numberCovered: number;
        readonly coverage: number;
    }>;
    /** Non-finite exclusion evidence */
    readonly exclusionEvidence: {
        readonly numberExcludedNonFinite: number;
        readonly numberExcludedInsufficientHistory: number;
    };
    /** Evaluation window */
    readonly evaluationWindow: {
        readonly start: string;
        readonly end: string;
    };
    /** Provenance */
    readonly provenance: CalibrationProvenance;
    /** Leakage status */
    readonly leakageVerified: boolean;
    /** Error if any */
    readonly error?: string;
}

/**
 * Calibration provenance
 */
export interface CalibrationProvenance {
    readonly source: string;
    readonly tenant: string;
    readonly metric: string;
    readonly method: string;
    readonly coverageLevel: number;
    readonly evaluationWindow: {
        readonly start: string;
        readonly end: string;
    };
    readonly numberEvaluated: number;
    readonly numberCovered: number;
    readonly numberMissed: number;
    readonly calibrationRule: string;
    readonly evaluatedAt: string;
}

/**
 * Multi-level calibration report
 */
export interface MultiLevelCalibrationReport {
    readonly tenantId: string;
    readonly metricName: string;
    readonly method: string;
    readonly levels: ReadonlyArray<CoverageLevelResult>;
    readonly overallWindow: {
        readonly start: string;
        readonly end: string;
    };
    readonly provenance: CalibrationProvenance;
}

/**
 * Configuration for calibration evaluation
 */
export interface CalibrationConfig {
    /** Tenant ID (must match backtest) */
    readonly tenantId: string;
    /** Coverage levels to evaluate (e.g., [0.80, 0.90, 0.95]) */
    readonly coverageLevels: ReadonlyArray<number>;
    /**
     * Minimum number of evaluated predictions required for a
     * calibration claim. Below this, status = insufficient_data.
     * Default: 30
     */
    readonly minEvaluated?: number;
    /**
     * Calibration rule for "calibrated" status.
     * Status = calibrated if |coverageError| <= tolerance.
     * Default: 0.05 (5 percentage points)
     */
    readonly tolerance?: number;
}

const DEFAULT_MIN_EVALUATED = 30;
const DEFAULT_TOLERANCE = 0.05;

/**
 * CalibrationEvaluator - evaluates empirical prediction intervals
 * against walk-forward backtest actuals.
 */
export const CalibrationEvaluator = {
    /**
     * Evaluate calibration for a single coverage level.
     */
    evaluate(
        backtest: BacktestResult,
        requestedCoverage: number,
        config: CalibrationConfig
    ): CoverageLevelResult {
        const minEvaluated = config.minEvaluated ?? DEFAULT_MIN_EVALUATED;
        const tolerance = config.tolerance ?? DEFAULT_TOLERANCE;
        const calibrationRule =
            `calibrated if |empirical - requested| <= tolerance(${tolerance}) AND n >= minEvaluated(${minEvaluated}); ` +
            `under-covered if empirical < requested - tolerance(${tolerance}); ` +
            `over-covered if empirical > requested + tolerance(${tolerance}); ` +
            `insufficient_data if n < minEvaluated(${minEvaluated})`;

        // Validate inputs
        if (typeof requestedCoverage !== "number" ||
            !isFiniteValue(requestedCoverage) ||
            requestedCoverage <= 0 ||
            requestedCoverage >= 1) {
            return buildCoverageError(
                requestedCoverage, 0, 0, 0, 0, 0, 0, 0, 0,
                "invalid_request",
                calibrationRule,
                "Coverage must be strictly between 0 and 1"
            );
        }

        if (!backtest || backtest.status !== "success") {
            return buildCoverageError(
                requestedCoverage, 0, 0, 0, 0, 0, 0, 0, 0,
                "unavailable",
                calibrationRule,
                "Backtest result is missing or has non-success status"
            );
        }

        if (backtest.tenantId !== config.tenantId) {
            return buildCoverageError(
                requestedCoverage, 0, 0, 0, 0, 0, 0, 0, 0,
                "invalid_request",
                calibrationRule,
                `Tenant mismatch: backtest tenant ${backtest.tenantId} != config tenant ${config.tenantId}`
            );
        }

        if (backtest.splits.length < 2) {
            // Need at least 2 splits: 1 to build residuals, 1 to evaluate
            return buildCoverageError(
                requestedCoverage, 0, 0, 0, 0, 0, 0, 0, 0,
                "insufficient_data",
                calibrationRule,
                "Backtest has fewer than 2 splits; cannot perform walk-forward calibration"
            );
        }

        if (!backtest.leakageStatus.allSplitsHaveNoLeakage) {
            return buildCoverageError(
                requestedCoverage, 0, 0, 0, 0, 0, 0, 0, 0,
                "invalid_request",
                calibrationRule,
                "Backtest has leakage; cannot evaluate calibration on leaky data"
            );
        }

        // Walk-forward: for each split i (i >= 1), build residuals from splits [0, i-1]
        // and evaluate intervals for split i.
        const perSplitResults: Array<{
            splitIndex: number;
            numberEvaluated: number;
            numberCovered: number;
        }> = [];
        const horizonMap = new Map<number, { evaluated: number; covered: number; widths: number[] }>();
        const widths: number[] = [];
        let totalEvaluated = 0;
        let totalCovered = 0;
        let totalExcludedNonFinite = 0;
        let totalExcludedInsufficientHistory = 0;

        for (let i = 1; i < backtest.splits.length; i++) {
            const evalSplit = backtest.splits[i];
            const priorSplits = backtest.splits.slice(0, i);

            // Build residual set from prior splits
            const priorBacktest: BacktestResult = {
                ...backtest,
                splits: priorSplits
            };
            const residualSet = ResidualAnalyzer.extractFromBacktest(priorBacktest);
            if (!residualSet || residualSet.residuals.length < 3) {
                // Not enough history to compute an interval
                // Mark all predictions in this split as excluded
                const predCount = Math.min(
                    evalSplit.predictions.length,
                    evalSplit.actuals.length
                );
                totalExcludedInsufficientHistory += predCount;
                continue;
            }

            // Evaluate each prediction/actual pair in this split
            let splitEvaluated = 0;
            let splitCovered = 0;
            const minLen = Math.min(evalSplit.predictions.length, evalSplit.actuals.length);
            for (let j = 0; j < minLen; j++) {
                const pred = evalSplit.predictions[j];
                const actual = evalSplit.actuals[j];

                // Explicit non-finite check (do NOT silently coerce)
                if (!isFiniteValue(pred.predictedValue)) {
                    totalExcludedNonFinite++;
                    continue;
                }
                if (!isFiniteValue(actual.actualValue)) {
                    totalExcludedNonFinite++;
                    continue;
                }

                // Compute interval
                const intervalResult = EmpiricalPredictionInterval.compute({
                    tenantId: backtest.tenantId,
                    metricName: backtest.metricName,
                    forecastingMethod: backtest.method,
                    forecastTimestamp: pred.timestamp,
                    step: j + 1,
                    pointForecast: pred.predictedValue,
                    coverage: requestedCoverage,
                    residualSet
                });

                if (intervalResult.status !== "calculated") {
                    // Cannot compute interval (insufficient residuals, etc.)
                    totalExcludedInsufficientHistory++;
                    continue;
                }

                const covered =
                    actual.actualValue >= intervalResult.interval.lowerBound &&
                    actual.actualValue <= intervalResult.interval.upperBound;

                const width = intervalResult.interval.upperBound - intervalResult.interval.lowerBound;

                splitEvaluated++;
                if (covered) splitCovered++;
                widths.push(width);
                totalEvaluated++;
                if (covered) totalCovered++;

                // Track per-horizon
                const step = j + 1;
                if (!horizonMap.has(step)) {
                    horizonMap.set(step, { evaluated: 0, covered: 0, widths: [] });
                }
                const h = horizonMap.get(step)!;
                h.evaluated++;
                if (covered) h.covered++;
                h.widths.push(width);
            }

            perSplitResults.push({
                splitIndex: evalSplit.splitIndex,
                numberEvaluated: splitEvaluated,
                numberCovered: splitCovered
            });
        }

        // Aggregate statistics
        if (totalEvaluated === 0) {
            return buildCoverageError(
                requestedCoverage, 0, 0, 0,
                totalExcludedNonFinite, totalExcludedInsufficientHistory,
                0, 0, 0,
                "insufficient_data",
                calibrationRule,
                "No predictions could be evaluated"
            );
        }

        const empiricalCoverage = totalCovered / totalEvaluated;
        const numberMissed = totalEvaluated - totalCovered;
        const coverageError = empiricalCoverage - requestedCoverage;

        // Width statistics
        const sortedWidths = [...widths].sort((a, b) => a - b);
        const averageWidth = widths.reduce((s, w) => s + w, 0) / widths.length;
        const medianWidth = computeMedian(sortedWidths);
        const minWidth = sortedWidths[0];
        const maxWidth = sortedWidths[sortedWidths.length - 1];

        // Classify calibration
        let status: CalibrationStatus;
        if (totalEvaluated < minEvaluated) {
            status = "insufficient_data";
        } else if (empiricalCoverage < requestedCoverage - tolerance) {
            status = "under-covered";
        } else if (empiricalCoverage > requestedCoverage + tolerance) {
            status = "over-covered";
        } else {
            status = "calibrated";
        }

        return Object.freeze({
            requestedCoverage,
            empiricalCoverage,
            numberEvaluated: totalEvaluated,
            numberCovered: totalCovered,
            numberMissed,
            coverageError,
            averageWidth,
            medianWidth,
            minWidth,
            maxWidth,
            status,
            calibrationRule,
            numberFiniteEvaluated: totalEvaluated,
            numberExcludedNonFinite: totalExcludedNonFinite,
            numberExcludedInsufficientHistory: totalExcludedInsufficientHistory
        });
    },

    /**
     * Evaluate calibration at multiple coverage levels.
     */
    evaluateMultiLevel(
        backtest: BacktestResult,
        config: CalibrationConfig
    ): MultiLevelCalibrationReport {
        const levels: CoverageLevelResult[] = [];
        for (const level of config.coverageLevels) {
            levels.push(this.evaluate(backtest, level, config));
        }

        return Object.freeze({
            tenantId: backtest?.tenantId ?? "",
            metricName: backtest?.metricName ?? "",
            method: backtest?.method ?? "",
            levels: Object.freeze(levels),
            overallWindow: {
                start: backtest?.overallWindow?.start ?? "",
                end: backtest?.overallWindow?.end ?? ""
            },
            provenance: Object.freeze({
                source: "calibration-evaluator",
                tenant: config.tenantId,
                metric: backtest?.metricName ?? "",
                method: backtest?.method ?? "",
                coverageLevel: config.coverageLevels[0] ?? 0,
                evaluationWindow: {
                    start: backtest?.overallWindow?.start ?? "",
                    end: backtest?.overallWindow?.end ?? ""
                },
                numberEvaluated: 0,
                numberCovered: 0,
                numberMissed: 0,
                calibrationRule: `tolerance=${config.tolerance ?? DEFAULT_TOLERANCE}, minEvaluated=${config.minEvaluated ?? DEFAULT_MIN_EVALUATED}`,
                evaluatedAt: "2026-01-01T00:00:00Z"
            })
        });
    },

    /**
     * Generate a full calibration report (single coverage level)
     * with horizon breakdown and per-origin coverage.
     */
    generateReport(
        backtest: BacktestResult,
        requestedCoverage: number,
        config: CalibrationConfig
    ): CalibrationReport {
        const levelResult = this.evaluate(backtest, requestedCoverage, config);
        const minEvaluated = config.minEvaluated ?? DEFAULT_MIN_EVALUATED;
        const tolerance = config.tolerance ?? DEFAULT_TOLERANCE;
        const calibrationRule = levelResult.calibrationRule;

        // Recompute horizon and per-origin for the report
        const perOriginCoverage: Array<{ splitIndex: number; numberEvaluated: number; numberCovered: number; coverage: number }> = [];
        const horizonMap = new Map<number, { evaluated: number; covered: number; widths: number[] }>();

        if (backtest?.status === "success" && backtest.splits.length >= 2) {
            for (let i = 1; i < backtest.splits.length; i++) {
                const evalSplit = backtest.splits[i];
                const priorSplits = backtest.splits.slice(0, i);
                const priorBacktest: BacktestResult = { ...backtest, splits: priorSplits };
                const residualSet = ResidualAnalyzer.extractFromBacktest(priorBacktest);

                let splitEval = 0;
                let splitCovered = 0;
                const minLen = Math.min(evalSplit.predictions.length, evalSplit.actuals.length);

                if (residualSet && residualSet.residuals.length >= 3) {
                    for (let j = 0; j < minLen; j++) {
                        const pred = evalSplit.predictions[j];
                        const actual = evalSplit.actuals[j];
                        if (!isFiniteValue(pred.predictedValue) || !isFiniteValue(actual.actualValue)) continue;

                        const intervalResult = EmpiricalPredictionInterval.compute({
                            tenantId: backtest.tenantId,
                            metricName: backtest.metricName,
                            forecastingMethod: backtest.method,
                            forecastTimestamp: pred.timestamp,
                            step: j + 1,
                            pointForecast: pred.predictedValue,
                            coverage: requestedCoverage,
                            residualSet
                        });
                        if (intervalResult.status !== "calculated") continue;

                        const covered =
                            actual.actualValue >= intervalResult.interval.lowerBound &&
                            actual.actualValue <= intervalResult.interval.upperBound;
                        const width = intervalResult.interval.upperBound - intervalResult.interval.lowerBound;

                        splitEval++;
                        if (covered) splitCovered++;
                        const step = j + 1;
                        if (!horizonMap.has(step)) {
                            horizonMap.set(step, { evaluated: 0, covered: 0, widths: [] });
                        }
                        const h = horizonMap.get(step)!;
                        h.evaluated++;
                        if (covered) h.covered++;
                        h.widths.push(width);
                    }
                }

                perOriginCoverage.push({
                    splitIndex: evalSplit.splitIndex,
                    numberEvaluated: splitEval,
                    numberCovered: splitCovered,
                    coverage: splitEval > 0 ? splitCovered / splitEval : 0
                });
            }
        }

        const horizonBreakdown: HorizonCoverage[] = [];
        for (const [step, h] of horizonMap.entries()) {
            horizonBreakdown.push(Object.freeze({
                step,
                coverage: h.evaluated > 0 ? h.covered / h.evaluated : 0,
                numberEvaluated: h.evaluated,
                numberCovered: h.covered,
                averageWidth: h.widths.length > 0
                    ? h.widths.reduce((s, w) => s + w, 0) / h.widths.length
                    : 0
            }));
        }
        horizonBreakdown.sort((a, b) => a.step - b.step);

        // Determine status for the report
        let status: CalibrationStatus;
        if (levelResult.numberEvaluated < minEvaluated) {
            status = "insufficient_data";
        } else if (levelResult.empiricalCoverage < requestedCoverage - tolerance) {
            status = "under-covered";
        } else if (levelResult.empiricalCoverage > requestedCoverage + tolerance) {
            status = "over-covered";
        } else {
            status = "calibrated";
        }

        return Object.freeze({
            tenantId: backtest?.tenantId ?? config.tenantId,
            metricName: backtest?.metricName ?? "",
            method: backtest?.method ?? "",
            requestedCoverage,
            empiricalCoverage: levelResult.empiricalCoverage,
            numberEvaluated: levelResult.numberEvaluated,
            numberCovered: levelResult.numberCovered,
            numberMissed: levelResult.numberMissed,
            coverageError: levelResult.coverageError,
            averageWidth: levelResult.averageWidth,
            medianWidth: levelResult.medianWidth,
            minWidth: levelResult.minWidth,
            maxWidth: levelResult.maxWidth,
            status,
            calibrationRule,
            minRequiredEvaluated: minEvaluated,
            horizonBreakdown: Object.freeze(horizonBreakdown),
            perOriginCoverage: Object.freeze(perOriginCoverage),
            exclusionEvidence: Object.freeze({
                numberExcludedNonFinite: levelResult.numberExcludedNonFinite,
                numberExcludedInsufficientHistory: levelResult.numberExcludedInsufficientHistory
            }),
            evaluationWindow: {
                start: backtest?.overallWindow?.start ?? "",
                end: backtest?.overallWindow?.end ?? ""
            },
            provenance: Object.freeze({
                source: "calibration-evaluator",
                tenant: config.tenantId,
                metric: backtest?.metricName ?? "",
                method: backtest?.method ?? "",
                coverageLevel: requestedCoverage,
                evaluationWindow: {
                    start: backtest?.overallWindow?.start ?? "",
                    end: backtest?.overallWindow?.end ?? ""
                },
                numberEvaluated: levelResult.numberEvaluated,
                numberCovered: levelResult.numberCovered,
                numberMissed: levelResult.numberMissed,
                calibrationRule,
                evaluatedAt: "2026-01-01T00:00:00Z"
            }),
            leakageVerified: backtest?.leakageStatus?.allSplitsHaveNoLeakage ?? false,
            error: levelResult.error
        });
    }
};

// ===== Helper functions =====

function isFiniteValue(v: number): boolean {
    return typeof v === "number" && Number.isFinite(v) && !isNaN(v);
}

function computeMedian(sortedValues: number[]): number {
    if (sortedValues.length === 0) return NaN;
    if (sortedValues.length === 1) return sortedValues[0];
    const mid = Math.floor(sortedValues.length / 2);
    if (sortedValues.length % 2 === 0) {
        return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
    }
    return sortedValues[mid];
}

function buildCoverageError(
    requestedCoverage: number,
    numberEvaluated: number,
    numberCovered: number,
    numberExcludedNonFinite: number,
    numberExcludedInsufficientHistory: number,
    _averageWidth: number,
    _medianWidth: number,
    _minWidth: number,
    _maxWidth: number,
    status: CalibrationStatus,
    calibrationRule: string,
    error: string
): CoverageLevelResult {
    return Object.freeze({
        requestedCoverage,
        empiricalCoverage: 0,
        numberEvaluated,
        numberCovered,
        numberMissed: numberEvaluated - numberCovered,
        coverageError: -requestedCoverage,
        averageWidth: 0,
        medianWidth: 0,
        minWidth: 0,
        maxWidth: 0,
        status,
        calibrationRule,
        numberFiniteEvaluated: 0,
        numberExcludedNonFinite,
        numberExcludedInsufficientHistory
    });
}
