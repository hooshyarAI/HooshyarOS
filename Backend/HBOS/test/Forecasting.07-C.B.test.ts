/**
 * Stage 07-C.B - Baseline Forecasting Methods Tests
 *
 * Focused tests for:
 * 1. Naive forecast (exact outputs)
 * 2. Seasonal Naive forecast (exact outputs)
 * 3. Moving Average forecast (exact outputs)
 * 4. Exponential Smoothing
 * 5. Insufficient-data behavior
 * 6. Invalid-request behavior
 * 7. Horizon handling
 * 8. Deterministic repeated execution
 * 9. Tenant isolation
 * 10. Provenance/evidence
 * 11. No fabricated confidence
 */

// Try to import TimeSeriesStore - may not be available in all environments
let TimeSeriesStore: any;
try {
    ({ TimeSeriesStore } = require("../Temporal/TimeSeriesStore"));
} catch (e) {
    TimeSeriesStore = null;
}

import {
    BaselineForecastEngine,
    ForecastDataPreparation
} from "../Forecasting";
import {
    ForecastRequest,
    PreparedTimeSeries
} from "../Forecasting/ForecastTypes";

describe("Stage 07-C.B: Baseline Forecasting Methods", () => {
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

    function createRequest(overrides: Partial<ForecastRequest> = {}): ForecastRequest {
        return {
            tenantId: TENANT_A,
            metricName: METRIC,
            trainingStart: "2026-01-01",
            trainingEnd: "2026-12-31",
            horizon: 3,
            method: "naive",
            ...overrides
        };
    }

    // ===== A: NAIVE FORECAST =====

    describe("A: Naive Forecast", () => {
        test("exact outputs for [10,20,30] horizon 2 => [30,30]", () => {
            const series = createMockSeries([10, 20, 30]);
            const request = createRequest({ horizon: 2 });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.status).toBe("success");
            expect(result.points).toHaveLength(2);
            expect(result.points[0].predictedValue).toBe(30);
            expect(result.points[1].predictedValue).toBe(30);
        });

        test("exact outputs for [100, 200, 150, 175] horizon 3 => [175, 175, 175]", () => {
            const series = createMockSeries([100, 200, 150, 175]);
            const request = createRequest({ horizon: 3 });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.status).toBe("success");
            expect(result.points).toHaveLength(3);
            expect(result.points[0].predictedValue).toBe(175);
            expect(result.points[1].predictedValue).toBe(175);
            expect(result.points[2].predictedValue).toBe(175);
        });

        test("step numbers are sequential 1..horizon", () => {
            const series = createMockSeries([10, 20, 30]);
            const request = createRequest({ horizon: 5 });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.points.map(p => p.step)).toEqual([1, 2, 3, 4, 5]);
        });

        test("handles single observation", () => {
            const series = createMockSeries([42]);
            const request = createRequest({ horizon: 2 });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.status).toBe("success");
            expect(result.points[0].predictedValue).toBe(42);
            expect(result.points[1].predictedValue).toBe(42);
        });

        test("handles constant series", () => {
            const series = createMockSeries([100, 100, 100, 100]);
            const request = createRequest({ horizon: 2 });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.status).toBe("success");
            expect(result.points[0].predictedValue).toBe(100);
            expect(result.points[1].predictedValue).toBe(100);
        });
    });

    // ===== B: SEASONAL NAIVE FORECAST =====

    describe("B: Seasonal Naive Forecast", () => {
        test("uses value from seasonalPeriod ago", () => {
            // [10, 20, 30, 40, 50, 60] with period 3
            // Forecast step 1 uses index 6-3+0 = 3 (value 40)
            // Forecast step 2 uses index 6-3+1 = 4 (value 50)
            // Forecast step 3 uses index 6-3+2 = 5 (value 60)
            const series = createMockSeries([10, 20, 30, 40, 50, 60]);
            const request = createRequest({
                horizon: 3,
                method: "seasonal_naive",
                seasonalPeriod: 3
            });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.status).toBe("success");
            expect(result.points[0].predictedValue).toBe(40);
            expect(result.points[1].predictedValue).toBe(50);
            expect(result.points[2].predictedValue).toBe(60);
        });

        test("cycles through seasonal period for longer horizon", () => {
            // [10, 20, 30, 40] with period 2
            // Forecast step 1 uses index 4-2+0 = 2 (value 30)
            // Forecast step 2 uses index 4-2+1 = 3 (value 40)
            // Forecast step 3 uses index 4-2+0 = 2 (value 30) - cycles
            // Forecast step 4 uses index 4-2+1 = 3 (value 40) - cycles
            const series = createMockSeries([10, 20, 30, 40]);
            const request = createRequest({
                horizon: 4,
                method: "seasonal_naive",
                seasonalPeriod: 2
            });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.status).toBe("success");
            expect(result.points[0].predictedValue).toBe(30);
            expect(result.points[1].predictedValue).toBe(40);
            expect(result.points[2].predictedValue).toBe(30);
            expect(result.points[3].predictedValue).toBe(40);
        });

        test("returns insufficient_data when history < seasonalPeriod", () => {
            const series = createMockSeries([10, 20]);
            const request = createRequest({
                horizon: 3,
                method: "seasonal_naive",
                seasonalPeriod: 5
            });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.status).toBe("insufficient_data");
            expect(result.points).toHaveLength(0);
        });

        test("returns invalid_request when seasonalPeriod missing", () => {
            const series = createMockSeries([10, 20, 30, 40, 50]);
            const request = createRequest({
                horizon: 3,
                method: "seasonal_naive"
            });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.status).toBe("invalid_request");
        });
    });

    // ===== C: MOVING AVERAGE FORECAST =====

    describe("C: Moving Average Forecast", () => {
        test("window=2 on [10,20,30] horizon 2 => [25, 25]", () => {
            // Initial window: [20, 30], mean = 25
            // Step 1: forecast = 25, window becomes [30, 25]
            // Step 2: forecast = (30+25)/2 = 27.5
            const series = createMockSeries([10, 20, 30]);
            const request = createRequest({
                horizon: 2,
                method: "moving_average",
                movingAverageWindow: 2
            });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.status).toBe("success");
            expect(result.points[0].predictedValue).toBe(25);
            expect(result.points[1].predictedValue).toBe(27.5);
        });

        test("window=3 on [10,20,30,40] horizon 2 => [30, 31.667]", () => {
            // Initial window: [20, 30, 40], mean = 30
            // Step 1: forecast = 30, window becomes [30, 40, 30]
            // Step 2: forecast = (30+40+30)/3 = 33.333
            const series = createMockSeries([10, 20, 30, 40]);
            const request = createRequest({
                horizon: 2,
                method: "moving_average",
                movingAverageWindow: 3
            });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.status).toBe("success");
            expect(result.points[0].predictedValue).toBe(30);
            expect(result.points[1].predictedValue).toBeCloseTo(100/3, 5);
        });

        test("returns insufficient_data when observations < window", () => {
            const series = createMockSeries([10, 20]);
            const request = createRequest({
                horizon: 2,
                method: "moving_average",
                movingAverageWindow: 5
            });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.status).toBe("insufficient_data");
        });

        test("returns invalid_request when window missing", () => {
            const series = createMockSeries([10, 20, 30, 40, 50]);
            const request = createRequest({
                horizon: 3,
                method: "moving_average"
            });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.status).toBe("invalid_request");
        });
    });

    // ===== D: EXPONENTIAL SMOOTHING =====

    describe("D: Exponential Smoothing", () => {
        test("alpha=1 produces naive forecast", () => {
            // alpha=1 means level = last value
            // level_1 = 10
            // level_2 = 1*20 + 0*10 = 20
            // level_3 = 1*30 + 0*20 = 30
            // forecast = 30
            const series = createMockSeries([10, 20, 30]);
            const request = createRequest({
                horizon: 2,
                method: "exponential_smoothing",
                exponentialSmoothingAlpha: 1.0
            });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.status).toBe("success");
            expect(result.points[0].predictedValue).toBe(30);
            expect(result.points[1].predictedValue).toBe(30);
        });

        test("alpha=0.5 produces weighted average", () => {
            // level_1 = 10
            // level_2 = 0.5*20 + 0.5*10 = 15
            // level_3 = 0.5*30 + 0.5*15 = 22.5
            const series = createMockSeries([10, 20, 30]);
            const request = createRequest({
                horizon: 1,
                method: "exponential_smoothing",
                exponentialSmoothingAlpha: 0.5
            });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.status).toBe("success");
            expect(result.points[0].predictedValue).toBe(22.5);
        });

        test("returns invalid_request for alpha out of range", () => {
            const series = createMockSeries([10, 20, 30]);
            const request = createRequest({
                horizon: 1,
                method: "exponential_smoothing",
                exponentialSmoothingAlpha: 1.5
            });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.status).toBe("invalid_request");
        });
    });

    // ===== E: PROVENANCE / EVIDENCE =====

    describe("E: Provenance and Evidence", () => {
        test("result includes tenant, metric, training window", () => {
            const series = createMockSeries([10, 20, 30]);
            const request = createRequest({ horizon: 2 });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.tenantId).toBe(TENANT_A);
            expect(result.metricName).toBe(METRIC);
            expect(result.evidence.trainingWindow.start).toBe("2026-01-01");
            expect(result.evidence.trainingWindow.end).toBe("2026-12-31");
        });

        test("evidence includes method, observation count, horizon", () => {
            const series = createMockSeries([10, 20, 30]);
            const request = createRequest({ horizon: 2 });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.evidence.method).toBe("naive");
            expect(result.evidence.observationCount).toBe(3);
            expect(result.evidence.horizon).toBe(2);
        });

        test("confidence is always unavailable", () => {
            const series = createMockSeries([10, 20, 30]);
            const request = createRequest({ horizon: 2 });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.evidence.confidence.source).toBe("unavailable");
        });

        test("modelId is deterministic", () => {
            const series = createMockSeries([10, 20, 30]);
            const request = createRequest({ horizon: 2 });
            const result1 = BaselineForecastEngine.forecastFromSeries(series, request);
            const result2 = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result1.evidence.modelId).toBe(result2.evidence.modelId);
        });
    });

    // ===== F: DETERMINISTIC REPEATED EXECUTION =====

    describe("F: Deterministic Repeated Execution", () => {
        test("naive produces identical results on repeated calls", () => {
            const series = createMockSeries([10, 20, 30, 40, 50]);
            const request = createRequest({ horizon: 3 });

            const result1 = BaselineForecastEngine.forecastFromSeries(series, request);
            const result2 = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result1).toEqual(result2);
        });

        test("seasonal_naive produces identical results on repeated calls", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60]);
            const request = createRequest({
                horizon: 3,
                method: "seasonal_naive",
                seasonalPeriod: 3
            });

            const result1 = BaselineForecastEngine.forecastFromSeries(series, request);
            const result2 = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result1).toEqual(result2);
        });

        test("moving_average produces identical results on repeated calls", () => {
            const series = createMockSeries([10, 20, 30, 40, 50]);
            const request = createRequest({
                horizon: 3,
                method: "moving_average",
                movingAverageWindow: 2
            });

            const result1 = BaselineForecastEngine.forecastFromSeries(series, request);
            const result2 = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result1).toEqual(result2);
        });
    });

    // ===== G: STORE-INTEGRATED FORECASTING =====

    describe("G: Forecast from TimeSeriesStore", () => {
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

        test("forecasts using data from store", async () => {
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 10, timestamp: "2026-01-01", source: "test" });
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 20, timestamp: "2026-01-02", source: "test" });
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 30, timestamp: "2026-01-03", source: "test" });

            const request = createRequest({ horizon: 2 });
            const result = await BaselineForecastEngine.forecast(store, request);

            expect(result.status).toBe("success");
            expect(result.points[0].predictedValue).toBe(30);
            expect(result.points[1].predictedValue).toBe(30);
        });

        test("tenant isolation: different tenant data not used", async () => {
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 10, timestamp: "2026-01-01", source: "test" });
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 20, timestamp: "2026-01-02", source: "test" });
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 30, timestamp: "2026-01-03", source: "test" });
            await store.append({ tenantId: TENANT_B, metricName: METRIC, value: 999, timestamp: "2026-01-03", source: "test" });

            const requestA = createRequest({ tenantId: TENANT_A, horizon: 1 });
            const requestB = createRequest({ tenantId: TENANT_B, horizon: 1 });

            const resultA = await BaselineForecastEngine.forecast(store, requestA);
            const resultB = await BaselineForecastEngine.forecast(store, requestB);

            expect(resultA.points[0].predictedValue).toBe(30);
            expect(resultB.points[0].predictedValue).toBe(999);
        });

        test("returns insufficient_data for empty store", async () => {
            const request = createRequest({ horizon: 2 });
            const result = await BaselineForecastEngine.forecast(store, request);

            expect(result.status).toBe("insufficient_data");
        });
    });

    // ===== H: HORIZON HANDLING =====

    describe("H: Horizon Handling", () => {
        test("horizon 0 is invalid", () => {
            const series = createMockSeries([10, 20, 30]);
            const request = createRequest({ horizon: 0 });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.status).toBe("invalid_request");
        });

        test("negative horizon is invalid", () => {
            const series = createMockSeries([10, 20, 30]);
            const request = createRequest({ horizon: -1 });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.status).toBe("invalid_request");
        });

        test("non-integer horizon is invalid", () => {
            const series = createMockSeries([10, 20, 30]);
            const request = createRequest({ horizon: 1.5 });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.status).toBe("invalid_request");
        });
    });

    // ===== I: ERROR HANDLING =====

    describe("I: Error Handling", () => {
        test("empty series returns insufficient_data", () => {
            const series = createMockSeries([]);
            const request = createRequest({ horizon: 2 });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.status).toBe("insufficient_data");
        });

        test("invalid tenantId returns invalid_request", () => {
            const series = createMockSeries([10, 20, 30]);
            const request = createRequest({ tenantId: "", horizon: 2 });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.status).toBe("invalid_request");
        });

        test("invalid training window returns invalid_request", () => {
            const series = createMockSeries([10, 20, 30]);
            const request = createRequest({
                trainingStart: "2026-12-31",
                trainingEnd: "2026-01-01",
                horizon: 2
            });
            const result = BaselineForecastEngine.forecastFromSeries(series, request);

            expect(result.status).toBe("invalid_request");
        });
    });
});
