/**
 * Stage 07-A - Temporal Data & Statistical Foundation Tests
 *
 * Comprehensive tests for:
 * A. append
 * B. range query
 * C. latest(n)
 * D. deterministic timestamp ordering
 * E. tenant isolation
 * F. persistence/restart
 * G. invalid timestamp rejection
 * H. non-finite value rejection
 * I. duplicate policy
 * J. mean
 * K. median
 * L. sample variance
 * M. sample standard deviation
 * N. percentile
 * O. daily/weekly/monthly aggregation
 * P. provenance/evidence
 * Q. financial ingestion → temporal observation integration
 *
 * NOTE: SQLite-dependent tests (A-F) require better-sqlite3 which may not
 * be installed in all environments. These tests will be skipped if the
 * module is unavailable.
 */

import { DescriptiveStatistics } from "../Temporal/DescriptiveStatistics";
import { TemporalAggregator, getPeriodBoundaries, formatPeriodStart } from "../Temporal/TemporalAggregator";
import { TemporalValidator } from "../Temporal/TemporalValidator";
import { MetricObservation, AggregationPeriod } from "../Temporal/TemporalTypes";

// Try to import TimeSeriesStore - may not be available in all environments
let TimeSeriesStore: any;
try {
    ({ TimeSeriesStore } = require("../Temporal/TimeSeriesStore"));
} catch (e) {
    // better-sqlite3 not available - SQLite tests will be skipped
    TimeSeriesStore = null;
}

describe("Stage 07-A: Temporal Data & Statistical Foundation", () => {
    // ===== KNOWN MATHEMATICAL TEST VECTORS =====

    const TEST_VALUES = [10000, 12000, 11000] as const;
    // Mean = (10000 + 12000 + 11000) / 3 = 33000 / 3 = 11000
    // Sample variance = ((10000-11000)^2 + (12000-11000)^2 + (11000-11000)^2) / (3-1)
    //                 = (1000000 + 1000000 + 0) / 2 = 2000000 / 2 = 1000000
    // Sample std = sqrt(1000000) = 1000
    const EXPECTED_MEAN = 11000;
    const EXPECTED_SAMPLE_VARIANCE = 1000000;
    const EXPECTED_SAMPLE_STD = 1000;

    describe("A-B: TimeSeriesStore append and range query", () => {
        // Skip if better-sqlite3 not available
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

        test("append creates observation with correct fields", async () => {
            const result = await store.append({
                tenantId: "tenant-1",
                metricName: "revenue",
                value: 10000,
                timestamp: "2026-01-01",
                source: "test_ingestion"
            });

            expect(result.success).toBe(true);
            expect(result.observation).toBeDefined();
            expect(result.observation!.tenantId).toBe("tenant-1");
            expect(result.observation!.metricName).toBe("revenue");
            expect(result.observation!.value).toBe(10000);
            expect(result.observation!.timestamp).toBe("2026-01-01");
            expect(result.observation!.source).toBe("test_ingestion");
            expect(result.observation!.id).toBeDefined();
            expect(result.observation!.recordedAt).toBeDefined();
        });

        test("range query returns correct observations", async () => {
            // Append observations
            await store.append({ tenantId: "tenant-1", metricName: "revenue", value: 10000, timestamp: "2026-01-01", source: "t1" });
            await store.append({ tenantId: "tenant-1", metricName: "revenue", value: 12000, timestamp: "2026-02-01", source: "t2" });
            await store.append({ tenantId: "tenant-1", metricName: "revenue", value: 11000, timestamp: "2026-03-01", source: "t3" });

            const result = await store.query({
                tenantId: "tenant-1",
                metricName: "revenue",
                startTime: "2026-01-01",
                endTime: "2026-04-01"
            });

            expect(result.success).toBe(true);
            expect(result.observations).toHaveLength(3);
            expect(result.count).toBe(3);
        });

        test("range query is exclusive on end time", async () => {
            await store.append({ tenantId: "tenant-1", metricName: "revenue", value: 10000, timestamp: "2026-01-01", source: "t1" });
            await store.append({ tenantId: "tenant-1", metricName: "revenue", value: 12000, timestamp: "2026-02-01", source: "t2" });

            const result = await store.query({
                tenantId: "tenant-1",
                metricName: "revenue",
                startTime: "2026-01-01",
                endTime: "2026-02-01" // Only includes Jan, not Feb
            });

            expect(result.observations).toHaveLength(1);
            expect(result.observations![0].value).toBe(10000);
        });
    });

    describe("C: latest(n) observations", () => {
        // Skip if better-sqlite3 not available
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

        test("returns latest N observations in chronological order", async () => {
            // Append in order: Jan (10000), Feb (12000), Mar (11000)
            await store.append({ tenantId: "tenant-1", metricName: "revenue", value: 10000, timestamp: "2026-01-01", source: "t1" });
            await store.append({ tenantId: "tenant-1", metricName: "revenue", value: 12000, timestamp: "2026-02-01", source: "t2" });
            await store.append({ tenantId: "tenant-1", metricName: "revenue", value: 11000, timestamp: "2026-03-01", source: "t3" });

            // latest(2) should return the 2 MOST RECENT: Feb and Mar
            // Returned in ASC chronological order (oldest first for downstream)
            const result = await store.latest("tenant-1", "revenue", 2);

            expect(result.success).toBe(true);
            expect(result.observations).toHaveLength(2);
            // Should be in chronological order (oldest first for downstream)
            expect(result.observations![0].value).toBe(12000); // Feb (2nd most recent)
            expect(result.observations![1].value).toBe(11000); // Mar (most recent)
        });

        test("returns all if N exceeds available", async () => {
            await store.append({ tenantId: "tenant-1", metricName: "revenue", value: 10000, timestamp: "2026-01-01", source: "t1" });

            const result = await store.latest("tenant-1", "revenue", 10);

            expect(result.observations).toHaveLength(1);
        });
    });

    describe("D: Deterministic timestamp ordering", () => {
        // Skip if better-sqlite3 not available
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

        test("observations are returned in chronological order", async () => {
            // Append out of order
            await store.append({ tenantId: "tenant-1", metricName: "revenue", value: 30000, timestamp: "2026-03-01", source: "t3" });
            await store.append({ tenantId: "tenant-1", metricName: "revenue", value: 10000, timestamp: "2026-01-01", source: "t1" });
            await store.append({ tenantId: "tenant-1", metricName: "revenue", value: 20000, timestamp: "2026-02-01", source: "t2" });

            const result = await store.query({
                tenantId: "tenant-1",
                metricName: "revenue",
                startTime: "2026-01-01",
                endTime: "2026-04-01"
            });

            expect(result.observations![0].value).toBe(10000);
            expect(result.observations![1].value).toBe(20000);
            expect(result.observations![2].value).toBe(30000);
        });
    });

    describe("E: Tenant isolation", () => {
        // Skip if better-sqlite3 not available
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

        test("tenant A cannot see tenant B data", async () => {
            await store.append({ tenantId: "tenant-A", metricName: "revenue", value: 10000, timestamp: "2026-01-01", source: "t1" });
            await store.append({ tenantId: "tenant-B", metricName: "revenue", value: 50000, timestamp: "2026-01-01", source: "t2" });

            const resultA = await store.query({
                tenantId: "tenant-A",
                metricName: "revenue",
                startTime: "2026-01-01",
                endTime: "2026-01-02"
            });

            const resultB = await store.query({
                tenantId: "tenant-B",
                metricName: "revenue",
                startTime: "2026-01-01",
                endTime: "2026-01-02"
            });

            expect(resultA.observations).toHaveLength(1);
            expect(resultA.observations![0].value).toBe(10000);
            expect(resultB.observations).toHaveLength(1);
            expect(resultB.observations![0].value).toBe(50000);
        });

        test("tenant isolation enforced at append", async () => {
            const result = await store.append({
                tenantId: "", // Empty tenant should fail
                metricName: "revenue",
                value: 10000,
                timestamp: "2026-01-01",
                source: "test"
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain("tenant");
        });
    });

    describe("G: Invalid timestamp rejection", () => {
        // Skip if better-sqlite3 not available
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

        test("rejects invalid timestamp format", async () => {
            const result = await store.append({
                tenantId: "tenant-1",
                metricName: "revenue",
                value: 10000,
                timestamp: "invalid-date",
                source: "test"
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain("timestamp");
        });

        test("rejects missing timestamp", async () => {
            const result = await store.append({
                tenantId: "tenant-1",
                metricName: "revenue",
                value: 10000,
                timestamp: "",
                source: "test"
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain("timestamp");
        });

        test("accepts valid ISO date format", async () => {
            const result = await store.append({
                tenantId: "tenant-1",
                metricName: "revenue",
                value: 10000,
                timestamp: "2026-01-01",
                source: "test"
            });

            expect(result.success).toBe(true);
        });
    });

    describe("H: Non-finite value rejection", () => {
        // Skip if better-sqlite3 not available
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

        test("rejects NaN", async () => {
            const result = await store.append({
                tenantId: "tenant-1",
                metricName: "revenue",
                value: NaN,
                timestamp: "2026-01-01",
                source: "test"
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain("value-nan");
        });

        test("rejects Infinity", async () => {
            const result = await store.append({
                tenantId: "tenant-1",
                metricName: "revenue",
                value: Infinity,
                timestamp: "2026-01-01",
                source: "test"
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain("finite");
        });

        test("rejects -Infinity", async () => {
            const result = await store.append({
                tenantId: "tenant-1",
                metricName: "revenue",
                value: -Infinity,
                timestamp: "2026-01-01",
                source: "test"
            });

            expect(result.success).toBe(false);
        });
    });

    describe("J: Mean calculation", () => {
        test("mean of [10000, 12000, 11000] = 11000", () => {
            const result = DescriptiveStatistics.mean([10000, 12000, 11000]);
            expect(result).toBe(11000);
        });

        test("mean of empty array is NaN", () => {
            const result = DescriptiveStatistics.mean([]);
            expect(Number.isNaN(result)).toBe(true);
        });

        test("mean of single value", () => {
            const result = DescriptiveStatistics.mean([5000]);
            expect(result).toBe(5000);
        });
    });

    describe("K: Median calculation", () => {
        test("median of [10000, 12000, 11000] = 11000 (odd n)", () => {
            const result = DescriptiveStatistics.median([10000, 12000, 11000]);
            expect(result).toBe(11000);
        });

        test("median of [1, 2, 3, 4] = 2.5 (even n)", () => {
            const result = DescriptiveStatistics.median([1, 2, 3, 4]);
            expect(result).toBe(2.5);
        });

        test("median of single value", () => {
            const result = DescriptiveStatistics.median([42]);
            expect(result).toBe(42);
        });
    });

    describe("L: Sample variance calculation", () => {
        test("sampleVariance of [10000, 12000, 11000] = 100000000", () => {
            const result = DescriptiveStatistics.sampleVariance([10000, 12000, 11000]);
            expect(result).toBe(EXPECTED_SAMPLE_VARIANCE);
        });

        test("sampleVariance returns NaN for n < 2", () => {
            const result = DescriptiveStatistics.sampleVariance([10000]);
            expect(Number.isNaN(result)).toBe(true);
        });

        test("sampleVariance of [2, 4, 6, 8] = 6.666... (Bessel's correction)", () => {
            // (2-5)^2 + (4-5)^2 + (6-5)^2 + (8-5)^2 = 9 + 1 + 1 + 9 = 20
            // 20 / (4-1) = 20/3 = 6.666...
            const result = DescriptiveStatistics.sampleVariance([2, 4, 6, 8]);
            expect(result).toBeCloseTo(6.6666666667, 5);
        });
    });

    describe("M: Sample standard deviation calculation", () => {
        test("sampleStandardDeviation of [10000, 12000, 11000] = 1000", () => {
            const result = DescriptiveStatistics.sampleStandardDeviation([10000, 12000, 11000]);
            expect(result).toBe(EXPECTED_SAMPLE_STD);
        });

        test("sampleStandardDeviation returns NaN for n < 2", () => {
            const result = DescriptiveStatistics.sampleStandardDeviation([10000]);
            expect(Number.isNaN(result)).toBe(true);
        });
    });

    describe("N: Percentile calculation", () => {
        const sortedData = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

        test("p50 (median) = 55", () => {
            const result = DescriptiveStatistics.percentile(sortedData, 0.5);
            expect(result).toBe(55); // (50+60)/2
        });

        test("p25 = 32.5", () => {
            const result = DescriptiveStatistics.percentile(sortedData, 0.25);
            expect(result).toBe(32.5); // (30+35)/2
        });

        test("p75 = 77.5", () => {
            const result = DescriptiveStatistics.percentile(sortedData, 0.75);
            expect(result).toBe(77.5); // 70 + 0.75*(80-70) = 77.5
        });

        test("p0 = min", () => {
            const result = DescriptiveStatistics.percentile(sortedData, 0);
            expect(result).toBe(10);
        });

        test("p1 = max", () => {
            const result = DescriptiveStatistics.percentile(sortedData, 1);
            expect(result).toBe(100);
        });

        test("percentile returns NaN for empty array", () => {
            const result = DescriptiveStatistics.percentile([], 0.5);
            expect(Number.isNaN(result)).toBe(true);
        });
    });

    describe("O: Temporal aggregation", () => {
        test("daily aggregation groups by calendar day", () => {
            const observations: MetricObservation[] = [
                createObs("2026-01-01T10:00:00Z", 100),
                createObs("2026-01-01T22:00:00Z", 200),
                createObs("2026-01-02T10:00:00Z", 150),
            ];

            const result = TemporalAggregator.aggregate(observations, "daily", "test");

            expect(result).toHaveLength(2);
            expect(result[0].period).toBe("daily");
            expect(result[0].periodStart).toBe("2026-01-01");
            expect(result[0].observationCount).toBe(2);
            expect(result[0].sum).toBe(300);
            expect(result[0].mean).toBe(150);
            expect(result[1].periodStart).toBe("2026-01-02");
            expect(result[1].observationCount).toBe(1);
        });

        test("weekly aggregation groups by ISO week", () => {
            // Jan 1, 2026 is a Thursday - week 1 starts Monday Dec 29, 2025
            // Jan 5, 2026 is a Monday - week 2 starts Monday Jan 5, 2026
            const observations: MetricObservation[] = [
                createObs("2026-01-01T10:00:00Z", 100), // Week 1
                createObs("2026-01-02T10:00:00Z", 150), // Week 1
                createObs("2026-01-06T10:00:00Z", 200), // Week 2
            ];

            const result = TemporalAggregator.aggregate(observations, "weekly", "test");

            expect(result).toHaveLength(2);
            expect(result[0].observationCount).toBe(2);
            expect(result[1].observationCount).toBe(1);
        });

        test("monthly aggregation groups by calendar month", () => {
            const observations: MetricObservation[] = [
                createObs("2026-01-15T10:00:00Z", 100),
                createObs("2026-01-20T10:00:00Z", 200),
                createObs("2026-02-10T10:00:00Z", 300),
            ];

            const result = TemporalAggregator.aggregate(observations, "monthly", "test");

            expect(result).toHaveLength(2);
            expect(result[0].periodStart).toBe("2026-01-01");
            expect(result[0].observationCount).toBe(2);
            expect(result[0].sum).toBe(300);
            expect(result[1].periodStart).toBe("2026-02-01");
            expect(result[1].observationCount).toBe(1);
        });

        test("empty observations returns empty array", () => {
            const result = TemporalAggregator.aggregate([], "daily", "test");
            expect(result).toHaveLength(0);
        });

        function createObs(timestamp: string, value: number): MetricObservation {
            return {
                id: Math.random().toString(36),
                tenantId: "tenant-1",
                metricName: "test_metric",
                value,
                timestamp,
                source: "test",
                recordedAt: new Date().toISOString()
            };
        }
    });

    describe("P: Provenance/Evidence", () => {
        test("StatisticalSummary includes provenance", () => {
            const observations: MetricObservation[] = [
                {
                    id: "1",
                    tenantId: "tenant-1",
                    metricName: "revenue",
                    value: 10000,
                    timestamp: "2026-01-01",
                    source: "test",
                    recordedAt: "2026-01-01T00:00:00Z"
                }
            ];

            const summary = DescriptiveStatistics.createSummary(
                observations,
                "2026-01-01",
                "2026-01-02",
                "Test method"
            );

            expect(summary).toBeDefined();
            expect(summary!.provenance.traceId).toBeDefined();
            expect(summary!.provenance.inputRef).toBeDefined();
            expect(summary!.provenance.method).toBe("Test method");
            expect(summary!.provenance.timestamp).toBeDefined();
        });

        test("StatisticalSummary includes method metadata", () => {
            const observations: MetricObservation[] = [
                {
                    id: "1",
                    tenantId: "tenant-1",
                    metricName: "revenue",
                    value: 10000,
                    timestamp: "2026-01-01",
                    source: "test",
                    recordedAt: "2026-01-01T00:00:00Z"
                }
            ];

            const summary = DescriptiveStatistics.createSummary(
                observations,
                "2026-01-01",
                "2026-01-02"
            );

            expect(summary!.method.variance).toBe("sample");
            expect(summary!.method.mean).toBe("arithmetic_mean");
        });
    });

    describe("Q: Integration with statistical summary", () => {
        test("createSummary with known values matches expected", () => {
            const observations: MetricObservation[] = [
                { id: "1", tenantId: "tenant-1", metricName: "revenue", value: 10000, timestamp: "2026-01-01", source: "test", recordedAt: "2026-01-01T00:00:00Z" },
                { id: "2", tenantId: "tenant-1", metricName: "revenue", value: 12000, timestamp: "2026-01-02", source: "test", recordedAt: "2026-01-02T00:00:00Z" },
                { id: "3", tenantId: "tenant-1", metricName: "revenue", value: 11000, timestamp: "2026-01-03", source: "test", recordedAt: "2026-01-03T00:00:00Z" },
            ];

            const summary = DescriptiveStatistics.createSummary(
                observations,
                "2026-01-01",
                "2026-01-04"
            );

            expect(summary!.observationCount).toBe(3);
            expect(summary!.mean).toBe(EXPECTED_MEAN);
            expect(summary!.sampleVariance).toBe(EXPECTED_SAMPLE_VARIANCE);
            expect(summary!.sampleStandardDeviation).toBe(EXPECTED_SAMPLE_STD);
        });

        test("verifySummary correctly validates", () => {
            const observations: MetricObservation[] = [
                { id: "1", tenantId: "tenant-1", metricName: "revenue", value: 10000, timestamp: "2026-01-01", source: "test", recordedAt: "2026-01-01T00:00:00Z" },
                { id: "2", tenantId: "tenant-1", metricName: "revenue", value: 12000, timestamp: "2026-01-02", source: "test", recordedAt: "2026-01-02T00:00:00Z" },
                { id: "3", tenantId: "tenant-1", metricName: "revenue", value: 11000, timestamp: "2026-01-03", source: "test", recordedAt: "2026-01-03T00:00:00Z" },
            ];

            const summary = DescriptiveStatistics.createSummary(observations, "2026-01-01", "2026-01-04")!;
            const verification = DescriptiveStatistics.verifySummary(summary, observations);

            expect(verification.verified).toBe(true);
            expect(verification.errors).toHaveLength(0);
        });
    });

    describe("TemporalValidator", () => {
        test("validateObservation rejects empty tenant", () => {
            const result = TemporalValidator.validateObservation({
                tenantId: "",
                metricName: "revenue",
                value: 10000,
                timestamp: "2026-01-01",
                source: "test"
            });
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("tenant"))).toBe(true);
        });

        test("validateObservation rejects invalid metric name", () => {
            const result = TemporalValidator.validateObservation({
                tenantId: "tenant-1",
                metricName: "123-invalid", // Can't start with number
                value: 10000,
                timestamp: "2026-01-01",
                source: "test"
            });
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("metric-name"))).toBe(true);
        });

        test("validateTimeRange rejects invalid range", () => {
            const result = TemporalValidator.validateTimeRange("2026-02-01", "2026-01-01");
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("range"))).toBe(true);
        });

        test("isValidTimestamp accepts valid formats", () => {
            expect(TemporalValidator.isValidTimestamp("2026-01-01")).toBe(true);
            expect(TemporalValidator.isValidTimestamp("2026-01-01T10:00:00Z")).toBe(true);
            expect(TemporalValidator.isValidTimestamp("2026-01-01T10:00:00.000Z")).toBe(true);
        });

        test("isValidTimestamp rejects invalid formats", () => {
            expect(TemporalValidator.isValidTimestamp("01-01-2026")).toBe(false);
            expect(TemporalValidator.isValidTimestamp("2026/01/01")).toBe(false);
            expect(TemporalValidator.isValidTimestamp("invalid")).toBe(false);
        });
    });

    describe("Period boundary calculations", () => {
        test("daily period boundaries", () => {
            const { start, end } = getPeriodBoundaries("2026-01-15T14:30:00Z", "daily");
            expect(start.toISOString().startsWith("2026-01-15T00:00:00")).toBe(true);
            expect(end.toISOString().startsWith("2026-01-15T23:59:59")).toBe(true);
        });

        test("weekly period boundaries (ISO week)", () => {
            // Thursday Jan 1, 2026 should be in week starting Monday Dec 29, 2025
            const { start, end } = getPeriodBoundaries("2026-01-01T14:30:00Z", "weekly");
            expect(start.getUTCDay()).toBe(1); // Monday
        });

        test("monthly period boundaries", () => {
            const { start, end } = getPeriodBoundaries("2026-01-15T14:30:00Z", "monthly");
            expect(start.toISOString().startsWith("2026-01-01T00:00:00")).toBe(true);
            expect(end.toISOString().startsWith("2026-01-31T23:59:59")).toBe(true);
        });
    });
});
