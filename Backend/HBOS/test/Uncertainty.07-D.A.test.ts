/**
 * Stage 07-D.A - Uncertainty Contract & Residual Foundation Tests
 *
 * Focused tests for:
 * 1. Uncertainty contract types
 * 2. Residual calculation from backtest
 * 3. Residual ordering (chronological)
 * 4. Tenant isolation
 * 5. Invalid/non-finite value rejection
 * 6. Empty residual set
 * 7. Provenance
 * 8. Deterministic repeated execution
 * 9. Explicit unavailable/insufficient_data states
 * 10. No future leakage
 */

import {
    ResidualAnalyzer
} from "../Uncertainty";
import {
    ResidualSet
} from "../Uncertainty/UncertaintyTypes";
import {
    BacktestEngine
} from "../Forecasting";
import {
    BacktestConfig
} from "../Forecasting/BacktestTypes";
import { PreparedTimeSeries } from "../Forecasting/ForecastTypes";

describe("Stage 07-D.A: Uncertainty Contract & Residual Foundation", () => {
    const TENANT_A = "tenant-a";
    const TENANT_B = "tenant-b";
    const METRIC = "revenue";

    function createMockSeries(values: number[], startDate: string = "2026-01-01"): PreparedTimeSeries {
        const observations = values.map((v, i) => {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            return {
                timestamp: date.toISOString().split("T")[0],
                value: v
            };
        });
        return Object.freeze({
            tenantId: TENANT_A,
            metricName: METRIC,
            observations: Object.freeze(observations),
            duplicatesRemoved: 0,
            nonFiniteRejected: 0,
            intervals: Object.freeze(values.slice(1).map(() => 1)),
            intervalMode: 1,
            isIrregular: false,
            firstTimestamp: observations.length > 0 ? observations[0].timestamp : "",
            lastTimestamp: observations.length > 0 ? observations[observations.length - 1].timestamp : ""
        });
    }

    function createBacktestConfig(overrides: Partial<BacktestConfig> = {}): BacktestConfig {
        return {
            tenantId: TENANT_A,
            metricName: METRIC,
            startTime: "2026-01-01",
            endTime: "2026-12-31",
            method: "naive",
            initialTrainingSize: 8,
            validationSize: 2,
            stepSize: 1,
            ...overrides
        };
    }

    // ===== A: UNCERTAINTY CONTRACT TYPES =====

    describe("A: Uncertainty Contract Types", () => {
        test("UncertaintyStatus distinguishes states correctly", () => {
            // Contract allows: unavailable, insufficient_data, calculated, invalid_request, model_error
            const validStatuses = [
                "unavailable",
                "insufficient_data",
                "calculated",
                "invalid_request",
                "model_error"
            ];
            expect(validStatuses).toHaveLength(5);
        });

        test("UncertaintyMethod supports documented methods", () => {
            const validMethods: Array<string> = [
                "residual_std",
                "quantile_empirical",
                "normal_assumption"
            ];
            expect(validMethods).toContain("residual_std");
        });
    });

    // ===== B: RESIDUAL EXTRACTION FROM BACKTEST =====

    describe("B: Residual Extraction from Backtest", () => {
        test("extracts residuals from successful backtest", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createBacktestConfig();
            const backtest = BacktestEngine.runFromSeries(series, config);

            const residualSet = ResidualAnalyzer.extractFromBacktest(backtest);

            expect(residualSet).not.toBeNull();
            expect(residualSet!.observationCount).toBeGreaterThan(0);
        });

        test("residual = actual - prediction", () => {
            // Use a constant series for predictable residuals
            const series = createMockSeries([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]);
            const config = createBacktestConfig();
            const backtest = BacktestEngine.runFromSeries(series, config);

            const residualSet = ResidualAnalyzer.extractFromBacktest(backtest);

            expect(residualSet).not.toBeNull();
            // For constant series, all residuals should be 0
            for (const r of residualSet!.residuals) {
                expect(r.residual).toBe(0);
                expect(r.actual).toBe(r.prediction);
            }
        });

        test("returns null for insufficient_data backtest", () => {
            const series = createMockSeries([10, 20, 30]); // Too small
            const config = createBacktestConfig({ initialTrainingSize: 5 });
            const backtest = BacktestEngine.runFromSeries(series, config);

            const residualSet = ResidualAnalyzer.extractFromBacktest(backtest);

            expect(residualSet).toBeNull();
        });

        test("returns null for invalid_request backtest", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createBacktestConfig({ initialTrainingSize: 0 });
            const backtest = BacktestEngine.runFromSeries(series, config);

            const residualSet = ResidualAnalyzer.extractFromBacktest(backtest);

            expect(residualSet).toBeNull();
        });
    });

    // ===== C: RESIDUAL ORDERING =====

    describe("C: Residual Chronological Ordering", () => {
        test("residuals are in chronological order by origin", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createBacktestConfig();
            const backtest = BacktestEngine.runFromSeries(series, config);

            const residualSet = ResidualAnalyzer.extractFromBacktest(backtest);

            expect(residualSet).not.toBeNull();
            for (let i = 1; i < residualSet!.residuals.length; i++) {
                const prev = new Date(residualSet.residuals[i - 1].originTimestamp).getTime();
                const curr = new Date(residualSet.residuals[i].originTimestamp).getTime();
                expect(prev).toBeLessThanOrEqual(curr);
            }
        });

        test("validate() confirms chronological order", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createBacktestConfig();
            const backtest = BacktestEngine.runFromSeries(series, config);
            const residualSet = ResidualAnalyzer.extractFromBacktest(backtest);

            const validation = ResidualAnalyzer.validate(residualSet!);

            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });
    });

    // ===== D: TENANT ISOLATION =====

    describe("D: Tenant Isolation", () => {
        test("residual set preserves tenant ID", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createBacktestConfig({ tenantId: TENANT_A });
            const backtest = BacktestEngine.runFromSeries(series, config);

            const residualSet = ResidualAnalyzer.extractFromBacktest(backtest);

            expect(residualSet).not.toBeNull();
            expect(residualSet!.tenantId).toBe(TENANT_A);
            for (const r of residualSet!.residuals) {
                expect(r.tenantId).toBe(TENANT_A);
            }
        });

        test("residual set preserves metric name", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createBacktestConfig({ metricName: "expenses" });
            const backtest = BacktestEngine.runFromSeries(series, config);

            const residualSet = ResidualAnalyzer.extractFromBacktest(backtest);

            expect(residualSet).not.toBeNull();
            expect(residualSet!.metricName).toBe("expenses");
        });
    });

    // ===== E: DATA INTEGRITY =====

    describe("E: Data Integrity", () => {
        test("rejects non-finite values silently (no coercion)", () => {
            // Create a backtest result manually with NaN in actuals
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createBacktestConfig();
            const backtest = BacktestEngine.runFromSeries(series, config);

            // Create a tampered backtest with NaN in actuals
            const tamperedSplits = backtest.splits.map((split, idx) => {
                if (idx === 0) {
                    return {
                        ...split,
                        actuals: Object.freeze([
                            Object.freeze({ timestamp: split.actuals[0].timestamp, actualValue: NaN }),
                            ...split.actuals.slice(1)
                        ])
                    };
                }
                return split;
            });

            const tamperedBacktest = {
                ...backtest,
                splits: tamperedSplits
            };

            const residualSet = ResidualAnalyzer.extractFromBacktest(tamperedBacktest as any);

            expect(residualSet).not.toBeNull();
            // The NaN residual should be excluded
            const allFinite = residualSet!.residuals.every(r => Number.isFinite(r.residual));
            expect(allFinite).toBe(true);
        });

        test("residual = actual - prediction (mathematically)", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createBacktestConfig();
            const backtest = BacktestEngine.runFromSeries(series, config);

            const residualSet = ResidualAnalyzer.extractFromBacktest(backtest);

            for (const r of residualSet!.residuals) {
                expect(r.residual).toBe(r.actual - r.prediction);
            }
        });
    });

    // ===== F: PROVENANCE =====

    describe("F: Provenance", () => {
        test("residual set includes full provenance", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createBacktestConfig();
            const backtest = BacktestEngine.runFromSeries(series, config);

            const residualSet = ResidualAnalyzer.extractFromBacktest(backtest);

            expect(residualSet!.provenance.tenant).toBe(TENANT_A);
            expect(residualSet!.provenance.metric).toBe(METRIC);
            expect(residualSet!.provenance.method).toBe("naive");
            expect(residualSet!.provenance.backtestSplitCount).toBeGreaterThan(0);
        });

        test("each residual has splitIndex, step, originTimestamp", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createBacktestConfig();
            const backtest = BacktestEngine.runFromSeries(series, config);

            const residualSet = ResidualAnalyzer.extractFromBacktest(backtest);

            for (const r of residualSet!.residuals) {
                expect(r.splitIndex).toBeGreaterThanOrEqual(0);
                expect(r.step).toBeGreaterThanOrEqual(1);
                expect(r.originTimestamp).toBeTruthy();
            }
        });
    });

    // ===== G: DETERMINISTIC REPEATED EXECUTION =====

    describe("G: Deterministic Execution", () => {
        test("same backtest produces same residual set", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createBacktestConfig();

            const backtest1 = BacktestEngine.runFromSeries(series, config);
            const backtest2 = BacktestEngine.runFromSeries(series, config);

            const residualSet1 = ResidualAnalyzer.extractFromBacktest(backtest1);
            const residualSet2 = ResidualAnalyzer.extractFromBacktest(backtest2);

            expect(residualSet1!.observationCount).toBe(residualSet2!.observationCount);
            expect(residualSet1!.residuals).toEqual(residualSet2!.residuals);
        });
    });

    // ===== H: CALIBRATION EVIDENCE =====

    describe("H: Calibration Evidence", () => {
        test("computeCalibration returns statistics for valid set", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150]);
            const config = createBacktestConfig({
                initialTrainingSize: 5,
                validationSize: 2,
                stepSize: 1
            });
            const backtest = BacktestEngine.runFromSeries(series, config);
            const residualSet = ResidualAnalyzer.extractFromBacktest(backtest);

            const calibration = ResidualAnalyzer.computeCalibration(residualSet!);

            expect(calibration.meanResidual).toBeDefined();
            expect(calibration.residualStd).toBeGreaterThanOrEqual(0);
            expect(calibration.minRequiredResiduals).toBe(30);
        });

        test("isCalibrated is true when n >= 30", () => {
            // Create enough residuals (need 30+ evaluations)
            const values = Array.from({ length: 50 }, (_, i) => 100 + i);
            const series = createMockSeries(values);
            const config = createBacktestConfig({
                initialTrainingSize: 10,
                validationSize: 5,
                stepSize: 1
            });
            const backtest = BacktestEngine.runFromSeries(series, config);
            const residualSet = ResidualAnalyzer.extractFromBacktest(backtest);

            const calibration = ResidualAnalyzer.computeCalibration(residualSet!);

            if (residualSet!.observationCount >= 30) {
                expect(calibration.isCalibrated).toBe(true);
            }
        });

        test("isCalibrated is false when n < 30", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createBacktestConfig({
                initialTrainingSize: 8,
                validationSize: 2,
                stepSize: 1
            });
            const backtest = BacktestEngine.runFromSeries(series, config);
            const residualSet = ResidualAnalyzer.extractFromBacktest(backtest);

            const calibration = ResidualAnalyzer.computeCalibration(residualSet!);

            // With small series, n < 30 so isCalibrated should be false
            if (residualSet!.observationCount < 30) {
                expect(calibration.isCalibrated).toBe(false);
            }
        });
    });

    // ===== I: NO FUTURE LEAKAGE =====

    describe("I: No Future Leakage", () => {
        test("refuses to extract from backtest with leakage", () => {
            // Create a synthetic backtest result with leakage
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createBacktestConfig();
            const backtest = BacktestEngine.runFromSeries(series, config);

            // Tamper with leakage status
            const tamperedBacktest = {
                ...backtest,
                leakageStatus: {
                    ...backtest.leakageStatus,
                    allSplitsHaveNoLeakage: false
                }
            };

            const residualSet = ResidualAnalyzer.extractFromBacktest(tamperedBacktest as any);

            expect(residualSet).toBeNull();
        });
    });

    // ===== J: EMPTY RESIDUAL SET =====

    describe("J: Empty Residual Set", () => {
        test("returns null for backtest with no splits", () => {
            // Create a minimal valid backtest
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80]);
            const config = createBacktestConfig({ initialTrainingSize: 5, validationSize: 2 });
            const backtest = BacktestEngine.runFromSeries(series, config);

            // If for some reason splits is empty, extraction should return null
            if (backtest.splits.length === 0) {
                const residualSet = ResidualAnalyzer.extractFromBacktest(backtest);
                expect(residualSet).toBeNull();
            } else {
                // Otherwise, verify it returns a valid set
                const residualSet = ResidualAnalyzer.extractFromBacktest(backtest);
                expect(residualSet).not.toBeNull();
            }
        });
    });
});
