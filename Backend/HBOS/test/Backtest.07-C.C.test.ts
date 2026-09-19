/**
 * Stage 07-C.C - Backtesting & Forecast Metrics Tests
 *
 * Focused tests for:
 * 1. ForecastMetrics (MAE, RMSE, MAPE, sMAPE)
 * 2. BacktestEngine (walk-forward)
 * 3. No future leakage
 * 4. Tenant isolation
 * 5. Deterministic behavior
 * 6. Edge cases
 */

let TimeSeriesStore: any;
try {
    ({ TimeSeriesStore } = require("../Temporal/TimeSeriesStore"));
} catch (e) {
    TimeSeriesStore = null;
}

import {
    ForecastMetricsCalculator,
    BacktestEngine
} from "../Forecasting";
import {
    PreparedTimeSeries
} from "../Forecasting/ForecastTypes";
import {
    BacktestConfig
} from "../Forecasting/BacktestTypes";

describe("Stage 07-C.C: Backtesting & Forecast Metrics", () => {
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

    function createConfig(overrides: Partial<BacktestConfig> = {}): BacktestConfig {
        return {
            tenantId: TENANT_A,
            metricName: METRIC,
            startTime: "2026-01-01",
            endTime: "2026-12-31",
            method: "naive",
            initialTrainingSize: 5,
            validationSize: 2,
            stepSize: 1,
            ...overrides
        };
    }

    // ===== A: METRICS - MAE =====

    describe("A: MAE Metric", () => {
        test("MAE for [10,20,30] vs [12,18,33]", () => {
            // |10-12| + |20-18| + |30-33| = 2 + 2 + 3 = 7
            // MAE = 7/3 = 2.333...
            const mae = ForecastMetricsCalculator.mae([10, 20, 30], [12, 18, 33]);
            expect(mae).toBeCloseTo(7/3, 5);
        });

        test("MAE for perfect forecast is 0", () => {
            const mae = ForecastMetricsCalculator.mae([10, 20, 30], [10, 20, 30]);
            expect(mae).toBe(0);
        });

        test("MAE handles negative values", () => {
            const mae = ForecastMetricsCalculator.mae([-10, -20], [-12, -18]);
            expect(mae).toBe(2);
        });
    });

    // ===== B: METRICS - RMSE =====

    describe("B: RMSE Metric", () => {
        test("RMSE for [10,20,30] vs [12,18,33]", () => {
            // (10-12)^2 + (20-18)^2 + (30-33)^2 = 4 + 4 + 9 = 17
            // MSE = 17/3 = 5.666...
            // RMSE = sqrt(5.666...) = 2.380...
            const rmse = ForecastMetricsCalculator.rmse([10, 20, 30], [12, 18, 33]);
            expect(rmse).toBeCloseTo(Math.sqrt(17/3), 5);
        });

        test("RMSE for perfect forecast is 0", () => {
            const rmse = ForecastMetricsCalculator.rmse([10, 20, 30], [10, 20, 30]);
            expect(rmse).toBe(0);
        });
    });

    // ===== C: METRICS - MAPE =====

    describe("C: MAPE Metric", () => {
        test("MAPE for [10,20,30] vs [12,18,33]", () => {
            // |10-12|/10 + |20-18|/20 + |30-33|/30 = 0.2 + 0.1 + 0.1 = 0.4
            // MAPE = 0.4/3 * 100 = 13.333...
            const mape = ForecastMetricsCalculator.mape([10, 20, 30], [12, 18, 33]);
            expect(mape).toBeCloseTo(40/3, 5);
        });

        test("MAPE returns null when all actuals are zero", () => {
            const mape = ForecastMetricsCalculator.mape([0, 0, 0], [1, 2, 3]);
            expect(mape).toBeNull();
        });

        test("MAPE excludes zero actual values but uses remaining", () => {
            // [0, 10, 20] vs [5, 12, 18]
            // First sample excluded (actual=0)
            // |10-12|/10 + |20-18|/20 = 0.2 + 0.1 = 0.3
            // MAPE = 0.3/2 * 100 = 15
            const mape = ForecastMetricsCalculator.mape([0, 10, 20], [5, 12, 18]);
            expect(mape).toBeCloseTo(15, 5);
        });
    });

    // ===== D: METRICS - sMAPE =====

    describe("D: sMAPE Metric", () => {
        test("sMAPE for [10,20,30] vs [12,18,33]", () => {
            // 2|10-12|/(|10|+|12|) + 2|20-18|/(|20|+|18|) + 2|30-33|/(|30|+|33|)
            // = 4/22 + 4/38 + 6/63
            // = 0.18182 + 0.10526 + 0.09524
            // = 0.38232
            // sMAPE = 0.38232/3 * 100 = 12.744...
            const smape = ForecastMetricsCalculator.smape([10, 20, 30], [12, 18, 33]);
            const expected = ((2*2/22 + 2*2/38 + 2*3/63) / 3) * 100;
            expect(smape).toBeCloseTo(expected, 5);
        });

        test("sMAPE returns NaN when all values are zero", () => {
            const smape = ForecastMetricsCalculator.smape([0, 0, 0], [0, 0, 0]);
            expect(smape).toBeNaN();
        });
    });

    // ===== E: METRICS - AGGREGATE =====

    describe("E: Metric Aggregation", () => {
        test("aggregate combines multiple splits", () => {
            const metrics1 = { mae: 1, rmse: 2, mape: 10, smape: 5, mase: null, n: 3 };
            const metrics2 = { mae: 3, rmse: 4, mape: 20, smape: 15, mase: null, n: 2 };
            const aggregated = ForecastMetricsCalculator.aggregate([metrics1, metrics2]);

            // Weighted average
            expect(aggregated.mae).toBeCloseTo((1*3 + 3*2) / 5, 5);
            expect(aggregated.n).toBe(5);
        });

        test("aggregate of empty returns NaN/null", () => {
            const aggregated = ForecastMetricsCalculator.aggregate([]);
            expect(aggregated.mae).toBeNaN();
            expect(aggregated.mape).toBeNull();
            expect(aggregated.n).toBe(0);
        });
    });

    // ===== F: BACKTEST - BASIC EXECUTION =====

    describe("F: Backtest Basic Execution", () => {
        test("runs backtest with naive method", () => {
            const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
            const series = createMockSeries(values);
            const config = createConfig({
                initialTrainingSize: 5,
                validationSize: 2,
                stepSize: 1
            });

            const result = BacktestEngine.runFromSeries(series, config);

            expect(result.status).toBe("success");
            expect(result.splits.length).toBeGreaterThan(0);
        });

        test("each split has predictions and actuals", () => {
            const values = [10, 20, 30, 40, 50, 60, 70, 80];
            const series = createMockSeries(values);
            const config = createConfig({
                initialTrainingSize: 4,
                validationSize: 2,
                stepSize: 1
            });

            const result = BacktestEngine.runFromSeries(series, config);

            for (const split of result.splits) {
                expect(split.predictions.length).toBeGreaterThan(0);
                expect(split.actuals.length).toBeGreaterThan(0);
            }
        });

        test("aggregate metrics are computed", () => {
            const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
            const series = createMockSeries(values);
            const config = createConfig({
                initialTrainingSize: 5,
                validationSize: 2,
                stepSize: 1
            });

            const result = BacktestEngine.runFromSeries(series, config);

            expect(result.aggregateMetrics.n).toBeGreaterThan(0);
            expect(isNaN(result.aggregateMetrics.mae)).toBe(false);
        });
    });

    // ===== G: BACKTEST - NO FUTURE LEAKAGE =====

    describe("G: No Future Leakage", () => {
        test("leakageStatus.allSplitsHaveNoLeakage is true", () => {
            const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
            const series = createMockSeries(values);
            const config = createConfig({
                initialTrainingSize: 5,
                validationSize: 2,
                stepSize: 1
            });

            const result = BacktestEngine.runFromSeries(series, config);

            expect(result.leakageStatus.verified).toBe(true);
            expect(result.leakageStatus.allSplitsHaveNoLeakage).toBe(true);
        });

        test("each split's trainingMaxTimestamp < validationMinTimestamp", () => {
            const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
            const series = createMockSeries(values);
            const config = createConfig({
                initialTrainingSize: 5,
                validationSize: 2,
                stepSize: 1
            });

            const result = BacktestEngine.runFromSeries(series, config);

            for (const split of result.splits) {
                expect(split.leakageCheck.noLeakage).toBe(true);
                expect(new Date(split.leakageCheck.trainingMaxTimestamp).getTime())
                    .toBeLessThan(new Date(split.leakageCheck.validationMinTimestamp).getTime());
            }
        });

        test("mutating future observation does not change earlier split predictions", () => {
            // Create two series identical except for a future value
            const baseValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
            const modifiedValues = [...baseValues];
            modifiedValues[9] = 999; // Mutate last (future) value

            const series1 = createMockSeries(baseValues);
            const series2 = createMockSeries(modifiedValues);
            const config = createConfig({
                initialTrainingSize: 5,
                validationSize: 2,
                stepSize: 1
            });

            const result1 = BacktestEngine.runFromSeries(series1, config);
            const result2 = BacktestEngine.runFromSeries(series2, config);

            // First split's predictions should be identical (training data unchanged)
            expect(result1.splits[0].predictions).toEqual(result2.splits[0].predictions);

            // First split's actuals should be identical for splits 0..n-1
            // (the mutation only affects the last split's actuals)
            expect(result1.splits[0].actuals).toEqual(result2.splits[0].actuals);
        });
    });

    // ===== H: BACKTEST - EDGE CASES =====

    describe("H: Backtest Edge Cases", () => {
        test("returns invalid_request when initialTrainingSize < 1", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60]);
            const config = createConfig({ initialTrainingSize: 0, validationSize: 2 });

            const result = BacktestEngine.runFromSeries(series, config);

            expect(result.status).toBe("invalid_request");
        });

        test("returns invalid_request when validationSize < 1", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60]);
            const config = createConfig({ initialTrainingSize: 5, validationSize: 0 });

            const result = BacktestEngine.runFromSeries(series, config);

            expect(result.status).toBe("invalid_request");
        });

        test("returns invalid_request when training+validation > total", () => {
            const series = createMockSeries([10, 20, 30]);
            const config = createConfig({ initialTrainingSize: 5, validationSize: 2 });

            const result = BacktestEngine.runFromSeries(series, config);

            expect(result.status).toBe("invalid_request");
        });

        test("constant series produces zero errors", () => {
            const series = createMockSeries([100, 100, 100, 100, 100, 100, 100, 100]);
            const config = createConfig({
                initialTrainingSize: 4,
                validationSize: 2,
                stepSize: 1
            });

            const result = BacktestEngine.runFromSeries(series, config);

            expect(result.status).toBe("success");
            // With naive and constant series, all errors should be 0
            for (const split of result.splits) {
                expect(split.metrics.mae).toBe(0);
                expect(split.metrics.rmse).toBe(0);
            }
        });

        test("perfect forecast produces zero errors", () => {
            // For a monotone linear series, naive will predict last value
            // which equals the next value only if series is constant
            // So we test with constant series which is "perfect" for naive
            const series = createMockSeries([50, 50, 50, 50, 50, 50, 50, 50]);
            const config = createConfig({
                initialTrainingSize: 4,
                validationSize: 2,
                method: "naive"
            });

            const result = BacktestEngine.runFromSeries(series, config);

            for (const split of result.splits) {
                expect(split.metrics.mae).toBe(0);
            }
        });
    });

    // ===== I: BACKTEST - ZERO VALUES FOR MAPE =====

    describe("I: Zero Values and MAPE", () => {
        test("MAPE handles zero actuals gracefully", () => {
            // Series with some zero values
            const series = createMockSeries([0, 10, 0, 20, 0, 30, 0, 40]);
            const config = createConfig({
                initialTrainingSize: 4,
                validationSize: 2,
                stepSize: 1
            });

            const result = BacktestEngine.runFromSeries(series, config);

            // Should not throw
            expect(result.status).toBe("success");
        });
    });

    // ===== J: BACKTEST - DETERMINISTIC =====

    describe("J: Deterministic Execution", () => {
        test("same input produces same output", () => {
            const values = [10, 20, 30, 40, 50, 60, 70, 80];
            const series1 = createMockSeries(values);
            const series2 = createMockSeries(values);
            const config = createConfig({
                initialTrainingSize: 4,
                validationSize: 2,
                stepSize: 1
            });

            const result1 = BacktestEngine.runFromSeries(series1, config);
            const result2 = BacktestEngine.runFromSeries(series2, config);

            expect(result1.numberOfSplits).toBe(result2.numberOfSplits);
            expect(result1.aggregateMetrics).toEqual(result2.aggregateMetrics);
            expect(result1.splits.length).toBe(result2.splits.length);
        });
    });

    // ===== K: BACKTEST - PROVENANCE =====

    describe("K: Provenance and Evidence", () => {
        test("result includes full provenance", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80]);
            const config = createConfig({
                initialTrainingSize: 4,
                validationSize: 2
            });

            const result = BacktestEngine.runFromSeries(series, config);

            expect(result.provenance.tenant).toBe(TENANT_A);
            expect(result.provenance.metric).toBe(METRIC);
            expect(result.provenance.method).toBe("naive");
            expect(result.provenance.numberOfSplits).toBeGreaterThan(0);
            expect(result.provenance.metricDefinitions.mae).toBe("mean(|y - yhat|)");
            expect(result.provenance.metricDefinitions.rmse).toBe("sqrt(mean((y - yhat)^2))");
        });

        test("no fabricated uncertainty", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80]);
            const config = createConfig({
                initialTrainingSize: 4,
                validationSize: 2
            });

            const result = BacktestEngine.runFromSeries(series, config);

            // No confidence field in backtest result
            expect((result as any).confidence).toBeUndefined();
        });
    });

    // ===== L: BACKTEST - STORE-INTEGRATED =====

    describe("L: Backtest with TimeSeriesStore", () => {
        const hasSQLite = TimeSeriesStore !== null;

        if (!hasSQLite) {
            test.skip("requires better-sqlite3", () => {});
            return;
        }

        let store: any;
        const TEST_DB = ":memory:";

        beforeEach(async () => {
            store = new TimeSeriesStore({ databasePath: TEST_DB });
            await store.initialize();
        });

        afterEach(() => {
            store.close();
        });

        test("runs backtest from store data", async () => {
            // Add 10 daily observations
            for (let i = 0; i < 10; i++) {
                const date = new Date("2026-01-01");
                date.setDate(date.getDate() + i);
                await store.append({
                    tenantId: TENANT_A,
                    metricName: METRIC,
                    value: 10 + i * 10,
                    timestamp: date.toISOString().split("T")[0],
                    source: "test"
                });
            }

            const config = createConfig({
                startTime: "2026-01-01",
                endTime: "2026-01-10",
                initialTrainingSize: 5,
                validationSize: 2
            });

            const result = await BacktestEngine.run(store, config);

            expect(result.status).toBe("success");
            expect(result.splits.length).toBeGreaterThan(0);
        });

        test("tenant isolation: only loads data for specified tenant", async () => {
            for (let i = 0; i < 10; i++) {
                const date = new Date("2026-01-01");
                date.setDate(date.getDate() + i);
                await store.append({
                    tenantId: TENANT_A,
                    metricName: METRIC,
                    value: 10 + i,
                    timestamp: date.toISOString().split("T")[0],
                    source: "test"
                });
                await store.append({
                    tenantId: TENANT_B,
                    metricName: METRIC,
                    value: 999,
                    timestamp: date.toISOString().split("T")[0],
                    source: "test"
                });
            }

            const configA = createConfig({
                tenantId: TENANT_A,
                startTime: "2026-01-01",
                endTime: "2026-01-10",
                initialTrainingSize: 5,
                validationSize: 2
            });
            const configB = createConfig({
                tenantId: TENANT_B,
                startTime: "2026-01-01",
                endTime: "2026-01-10",
                initialTrainingSize: 5,
                validationSize: 2
            });

            const resultA = await BacktestEngine.run(store, configA);
            const resultB = await BacktestEngine.run(store, configB);

            // Tenant A series: 10..19, Tenant B: all 999
            // Naive on tenant A: forecasts are values from training set
            // Naive on tenant B: forecasts are all 999

            // The aggregate mae should differ significantly
            expect(resultA.aggregateMetrics.mae).not.toBe(resultB.aggregateMetrics.mae);
        });
    });
});
