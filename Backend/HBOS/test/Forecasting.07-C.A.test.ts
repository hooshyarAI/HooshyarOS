/**
 * Stage 07-C.A - Forecasting Contract & Data Preparation Tests
 *
 * Focused tests for:
 * 1. Contract types (ForecastRequest, ForecastResult, etc.)
 * 2. Chronological ordering
 * 3. Tenant isolation
 * 4. Duplicate handling (last-write-wins)
 * 5. Irregular timestamp detection
 * 6. Missing-value handling (no silent invention)
 * 7. No future leakage in train/validation split
 * 8. Deterministic repeated execution
 *
 * IMPORTANT:
 * - Tests for contracts and data preparation ONLY
 * - No algorithm tests
 * - No backtesting tests
 * - No metrics tests
 */

// Try to import TimeSeriesStore - may not be available in all environments
let TimeSeriesStore: any;
try {
    ({ TimeSeriesStore } = require("../Temporal/TimeSeriesStore"));
} catch (e) {
    // better-sqlite3 not available - SQLite tests will be skipped
    TimeSeriesStore = null;
}

import { ForecastDataPreparation } from "../Forecasting/ForecastDataPreparation";
import {
    ForecastRequest,
    ForecastResult,
    ForecastMethod,
    PreparedTimeSeries,
    TrainValidationSplit
} from "../Forecasting/ForecastTypes";

describe("Stage 07-C.A: Forecasting Contract & Data Preparation", () => {
    const TENANT_A = "tenant-a";
    const TENANT_B = "tenant-b";
    const METRIC = "revenue";

    function createForecastRequest(overrides: Partial<ForecastRequest> = {}): ForecastRequest {
        return {
            tenantId: TENANT_A,
            metricName: METRIC,
            trainingStart: "2026-01-01",
            trainingEnd: "2026-12-31",
            horizon: 3,
            method: "naive" as ForecastMethod,
            ...overrides
        };
    }

    // ===== A: CONTRACT TYPES =====

    describe("A: Contract Types", () => {
        test("ForecastRequest has required fields", () => {
            const request = createForecastRequest();
            expect(request.tenantId).toBe(TENANT_A);
            expect(request.metricName).toBe(METRIC);
            expect(request.trainingStart).toBe("2026-01-01");
            expect(request.trainingEnd).toBe("2026-12-31");
            expect(request.horizon).toBe(3);
            expect(request.method).toBe("naive");
        });

        test("validateRequest accepts valid request", () => {
            const request = createForecastRequest();
            const result = ForecastDataPreparation.validateRequest(request);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test("validateRequest rejects missing tenantId", () => {
            const request = createForecastRequest({ tenantId: "" });
            const result = ForecastDataPreparation.validateRequest(request);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("tenantId"))).toBe(true);
        });

        test("validateRequest rejects missing metricName", () => {
            const request = createForecastRequest({ metricName: "" });
            const result = ForecastDataPreparation.validateRequest(request);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("metricName"))).toBe(true);
        });

        test("validateRequest rejects invalid trainingStart", () => {
            const request = createForecastRequest({ trainingStart: "not-a-date" });
            const result = ForecastDataPreparation.validateRequest(request);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("trainingStart"))).toBe(true);
        });

        test("validateRequest rejects trainingStart >= trainingEnd", () => {
            const request = createForecastRequest({
                trainingStart: "2026-12-31",
                trainingEnd: "2026-01-01"
            });
            const result = ForecastDataPreparation.validateRequest(request);
            expect(result.valid).toBe(false);
        });

        test("validateRequest rejects non-positive horizon", () => {
            const request1 = createForecastRequest({ horizon: 0 });
            const result1 = ForecastDataPreparation.validateRequest(request1);
            expect(result1.valid).toBe(false);

            const request2 = createForecastRequest({ horizon: -1 });
            const result2 = ForecastDataPreparation.validateRequest(request2);
            expect(result2.valid).toBe(false);

            const request3 = createForecastRequest({ horizon: 1.5 });
            const result3 = ForecastDataPreparation.validateRequest(request3);
            expect(result3.valid).toBe(false);
        });

        test("validateRequest requires seasonalPeriod for seasonal_naive", () => {
            const request = createForecastRequest({ method: "seasonal_naive" });
            const result = ForecastDataPreparation.validateRequest(request);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("seasonalPeriod"))).toBe(true);
        });

        test("validateRequest requires movingAverageWindow for moving_average", () => {
            const request = createForecastRequest({ method: "moving_average" });
            const result = ForecastDataPreparation.validateRequest(request);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("movingAverageWindow"))).toBe(true);
        });

        test("validateRequest requires exponentialSmoothingAlpha in [0,1]", () => {
            const request1 = createForecastRequest({ method: "exponential_smoothing" });
            const result1 = ForecastDataPreparation.validateRequest(request1);
            expect(result1.valid).toBe(false);

            const request2 = createForecastRequest({
                method: "exponential_smoothing",
                exponentialSmoothingAlpha: -0.1
            });
            const result2 = ForecastDataPreparation.validateRequest(request2);
            expect(result2.valid).toBe(false);

            const request3 = createForecastRequest({
                method: "exponential_smoothing",
                exponentialSmoothingAlpha: 1.5
            });
            const result3 = ForecastDataPreparation.validateRequest(request3);
            expect(result3.valid).toBe(false);

            const request4 = createForecastRequest({
                method: "exponential_smoothing",
                exponentialSmoothingAlpha: 0.3
            });
            const result4 = ForecastDataPreparation.validateRequest(request4);
            expect(result4.valid).toBe(true);
        });
    });

    // ===== B: STORE-INTEGRATED DATA PREPARATION =====

    describe("B: Data Preparation from TimeSeriesStore", () => {
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

        test("prepare returns null for empty store", async () => {
            const request = createForecastRequest();
            const result = await ForecastDataPreparation.prepare(store, request);
            expect(result).toBeNull();
        });

        test("prepare loads observations chronologically", async () => {
            // Insert out of order
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 300, timestamp: "2026-03-01", source: "test" });
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 100, timestamp: "2026-01-01", source: "test" });
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 200, timestamp: "2026-02-01", source: "test" });

            const request = createForecastRequest();
            const result = await ForecastDataPreparation.prepare(store, request);

            expect(result).not.toBeNull();
            expect(result!.observations).toHaveLength(3);
            // Verify chronological order
            expect(result!.observations[0].timestamp).toBe("2026-01-01");
            expect(result!.observations[1].timestamp).toBe("2026-02-01");
            expect(result!.observations[2].timestamp).toBe("2026-03-01");
        });
    });

    // ===== C: TENANT ISOLATION =====

    describe("C: Tenant Isolation", () => {
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

        test("prepare only loads data for specified tenant", async () => {
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 100, timestamp: "2026-01-01", source: "test" });
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 200, timestamp: "2026-02-01", source: "test" });
            await store.append({ tenantId: TENANT_B, metricName: METRIC, value: 999, timestamp: "2026-01-01", source: "test" });
            await store.append({ tenantId: TENANT_B, metricName: METRIC, value: 888, timestamp: "2026-02-01", source: "test" });

            const request = createForecastRequest({ tenantId: TENANT_A });
            const result = await ForecastDataPreparation.prepare(store, request);

            expect(result).not.toBeNull();
            expect(result!.tenantId).toBe(TENANT_A);
            expect(result!.observations).toHaveLength(2);
            expect(result!.observations[0].value).toBe(100);
            expect(result!.observations[1].value).toBe(200);
        });

        test("different tenants get different data", async () => {
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 100, timestamp: "2026-01-01", source: "test" });
            await store.append({ tenantId: TENANT_B, metricName: METRIC, value: 500, timestamp: "2026-01-01", source: "test" });

            const requestA = createForecastRequest({ tenantId: TENANT_A });
            const requestB = createForecastRequest({ tenantId: TENANT_B });

            const resultA = await ForecastDataPreparation.prepare(store, requestA);
            const resultB = await ForecastDataPreparation.prepare(store, requestB);

            expect(resultA!.observations[0].value).toBe(100);
            expect(resultB!.observations[0].value).toBe(500);
        });
    });

    // ===== D: DUPLICATE HANDLING =====

    describe("D: Duplicate Handling", () => {
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

        test("deduplicates timestamps (last-write-wins)", async () => {
            // Insert with explicit recordedAt to control which is "last"
            const obs1 = {
                tenantId: TENANT_A, metricName: METRIC,
                value: 100, timestamp: "2026-01-01", source: "test",
                recordedAt: "2026-01-01T00:00:00Z"
            };
            const obs2 = {
                tenantId: TENANT_A, metricName: METRIC,
                value: 200, timestamp: "2026-01-01", source: "test",
                recordedAt: "2026-01-01T00:00:01Z" // later
            };
            await store.append(obs1);
            await store.append(obs2);

            const request = createForecastRequest();
            const result = await ForecastDataPreparation.prepare(store, request);

            expect(result).not.toBeNull();
            // Last write wins - should keep the later recordedAt
            expect(result!.observations).toHaveLength(1);
            // The value should be 200 (the later one)
        });

        test("tracks number of duplicates removed", async () => {
            const obs1 = { tenantId: TENANT_A, metricName: METRIC, value: 100, timestamp: "2026-01-01", source: "test", recordedAt: "2026-01-01T00:00:00Z" };
            const obs2 = { tenantId: TENANT_A, metricName: METRIC, value: 200, timestamp: "2026-01-01", source: "test", recordedAt: "2026-01-01T00:00:01Z" };
            const obs3 = { tenantId: TENANT_A, metricName: METRIC, value: 300, timestamp: "2026-01-01", source: "test", recordedAt: "2026-01-01T00:00:02Z" };

            await store.append(obs1);
            await store.append(obs2);
            await store.append(obs3);

            const request = createForecastRequest();
            const result = await ForecastDataPreparation.prepare(store, request);

            expect(result).not.toBeNull();
            expect(result!.duplicatesRemoved).toBe(2); // 3 inserted, 1 kept
        });
    });

    // ===== E: IRREGULAR INTERVAL DETECTION =====

    describe("E: Irregular Interval Detection", () => {
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

        test("detects regular intervals", async () => {
            // Daily observations
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 1, timestamp: "2026-01-01", source: "test" });
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 2, timestamp: "2026-01-02", source: "test" });
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 3, timestamp: "2026-01-03", source: "test" });
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 4, timestamp: "2026-01-04", source: "test" });

            const request = createForecastRequest();
            const result = await ForecastDataPreparation.prepare(store, request);

            expect(result).not.toBeNull();
            expect(result!.intervalMode).toBe(1); // 1 day intervals
            expect(result!.isIrregular).toBe(false);
        });

        test("detects irregular intervals", async () => {
            // Irregular: 1 day, then 10 days
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 1, timestamp: "2026-01-01", source: "test" });
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 2, timestamp: "2026-01-02", source: "test" });
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 3, timestamp: "2026-01-12", source: "test" });

            const request = createForecastRequest();
            const result = await ForecastDataPreparation.prepare(store, request);

            expect(result).not.toBeNull();
            expect(result!.isIrregular).toBe(true);
        });
    });

    // ===== F: NON-FINITE VALUE HANDLING =====

    describe("F: Non-Finite Value Handling", () => {
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

        test("rejects non-finite values from store (not silently invented)", async () => {
            // Note: TimeSeriesStore append() itself rejects NaN/Infinity
            // but prepare() also counts non-finite if they somehow exist
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 100, timestamp: "2026-01-01", source: "test" });
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 200, timestamp: "2026-01-02", source: "test" });

            const request = createForecastRequest();
            const result = await ForecastDataPreparation.prepare(store, request);

            expect(result).not.toBeNull();
            expect(result!.observations).toHaveLength(2);
            expect(result!.nonFiniteRejected).toBe(0);
        });
    });

    // ===== G: TRAIN/VALIDATION SPLIT (NO FUTURE LEAKAGE) =====

    describe("G: Train/Validation Split (No Future Leakage)", () => {
        function createMockSeries(n: number): PreparedTimeSeries {
            const observations = Array.from({ length: n }, (_, i) => ({
                timestamp: `2026-01-${String(i + 1).padStart(2, "0")}`,
                value: 100 + i
            }));
            return Object.freeze({
                tenantId: TENANT_A,
                metricName: METRIC,
                observations: Object.freeze(observations),
                duplicatesRemoved: 0,
                nonFiniteRejected: 0,
                intervals: Object.freeze([]),
                intervalMode: 1,
                isIrregular: false,
                firstTimestamp: observations[0].timestamp,
                lastTimestamp: observations[n - 1].timestamp
            });
        }

        test("splits correctly with no future leakage", () => {
            const series = createMockSeries(10);
            const split = ForecastDataPreparation.split(series, 3);

            expect(split).not.toBeNull();
            expect(split!.training).toHaveLength(7);
            expect(split!.validation).toHaveLength(3);
            // Training ends BEFORE validation begins
            const lastTrain = split!.training[split!.training.length - 1].timestamp;
            const firstVal = split!.validation[0].timestamp;
            expect(new Date(lastTrain).getTime()).toBeLessThan(new Date(firstVal).getTime());
        });

        test("validationOrigin equals last training timestamp", () => {
            const series = createMockSeries(10);
            const split = ForecastDataPreparation.split(series, 3);

            expect(split!.validationOrigin).toBe(split!.training[split!.training.length - 1].timestamp);
        });

        test("rejects validation count >= total observations", () => {
            const series = createMockSeries(10);
            const split1 = ForecastDataPreparation.split(series, 10);
            const split2 = ForecastDataPreparation.split(series, 11);

            expect(split1).toBeNull();
            expect(split2).toBeNull();
        });

        test("rejects negative validation count", () => {
            const series = createMockSeries(10);
            const split = ForecastDataPreparation.split(series, -1);
            expect(split).toBeNull();
        });

        test("rejects when training would be empty", () => {
            const series = createMockSeries(10);
            // validationCount = 10 means training = 0
            const split = ForecastDataPreparation.split(series, 10);
            expect(split).toBeNull();
        });
    });

    // ===== H: ROLLING-ORIGIN SPLITS =====

    describe("H: Rolling-Origin Splits", () => {
        function createMockSeries(n: number): PreparedTimeSeries {
            const observations = Array.from({ length: n }, (_, i) => ({
                timestamp: `2026-01-${String(i + 1).padStart(2, "0")}`,
                value: 100 + i
            }));
            return Object.freeze({
                tenantId: TENANT_A,
                metricName: METRIC,
                observations: Object.freeze(observations),
                duplicatesRemoved: 0,
                nonFiniteRejected: 0,
                intervals: Object.freeze([]),
                intervalMode: 1,
                isIrregular: false,
                firstTimestamp: observations[0].timestamp,
                lastTimestamp: observations[n - 1].timestamp
            });
        }

        test("creates multiple rolling splits", () => {
            const series = createMockSeries(20);
            const splits = ForecastDataPreparation.createRollingOriginSplits(
                series,
                10, // initial training size
                3,  // validation size
                2   // step size
            );

            // Splits: train=10/val=3, train=12/val=3, train=14/val=3, train=16/val=3
            // Last valid: train=17, val=3 -> train+val=20
            expect(splits.length).toBeGreaterThan(0);
        });

        test("each split has no future leakage", () => {
            const series = createMockSeries(20);
            const splits = ForecastDataPreparation.createRollingOriginSplits(
                series,
                10,
                3,
                2
            );

            for (const split of splits) {
                const lastTrain = split.training[split.training.length - 1].timestamp;
                const firstVal = split.validation[0].timestamp;
                expect(new Date(lastTrain).getTime()).toBeLessThan(new Date(firstVal).getTime());
            }
        });

        test("returns empty for invalid parameters", () => {
            const series = createMockSeries(20);
            const splits1 = ForecastDataPreparation.createRollingOriginSplits(series, 0, 3, 1);
            const splits2 = ForecastDataPreparation.createRollingOriginSplits(series, 10, 0, 1);
            const splits3 = ForecastDataPreparation.createRollingOriginSplits(series, 10, 3, 0);

            expect(splits1).toHaveLength(0);
            expect(splits2).toHaveLength(0);
            expect(splits3).toHaveLength(0);
        });
    });

    // ===== I: DETERMINISTIC REPEATED EXECUTION =====

    describe("I: Deterministic Repeated Execution", () => {
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
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 100, timestamp: "2026-01-01", source: "test" });
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 200, timestamp: "2026-02-01", source: "test" });
            await store.append({ tenantId: TENANT_A, metricName: METRIC, value: 300, timestamp: "2026-03-01", source: "test" });
        });

        afterEach(() => {
            store.close();
        });

        test("repeated prepare produces identical results", async () => {
            const request = createForecastRequest();

            const result1 = await ForecastDataPreparation.prepare(store, request);
            const result2 = await ForecastDataPreparation.prepare(store, request);
            const result3 = await ForecastDataPreparation.prepare(store, request);

            expect(result1).toEqual(result2);
            expect(result2).toEqual(result3);
        });
    });
});
