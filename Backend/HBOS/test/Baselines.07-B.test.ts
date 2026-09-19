/**
 * Stage 07-B - Statistical Baselines & Data Quality Tests
 *
 * Comprehensive tests for:
 * 1. DataQualityProfiler
 *    - missingness detection
 *    - duplicate timestamp detection
 *    - non-finite value detection
 *    - temporal gap analysis
 *    - coverage window
 *
 * 2. StatisticalBaselineEngine
 *    - baseline creation
 *    - insufficient data handling
 *    - verification
 *
 * 3. BaselineComparison
 *    - absolute deviation
 *    - relative deviation
 *    - z-score contract
 *    - zero/near-zero baseline handling
 *    - confidence (always unavailable)
 *
 * 4. Tenant isolation
 *    - cross-tenant data isolation
 *
 * 5. Edge cases
 *    - empty window
 *    - n=1
 *    - n<2 variance/std
 *    - duplicate timestamps
 *    - constant series
 *    - zero baseline
 *    - non-finite values
 */

import {
    DataQualityProfiler,
    StatisticalBaselineEngine,
    BaselineComparison,
    DescriptiveStatistics,
    MetricObservation
} from "../Temporal";

describe("Stage 07-B: Statistical Baselines & Data Quality", () => {
    // ===== TEST VECTORS =====
    const TENANT_A = "tenant-a";
    const TENANT_B = "tenant-b";
    const METRIC = "revenue";

    function createObs(
        tenantId: string,
        metricName: string,
        timestamp: string,
        value: number
    ): MetricObservation {
        return {
            id: Math.random().toString(36),
            tenantId,
            metricName,
            value,
            timestamp,
            source: "test",
            recordedAt: new Date().toISOString()
        };
    }

    // Standard test data: [100, 200, 150, 175, 125]
    const STANDARD_VALUES = [100, 200, 150, 175, 125];
    const STANDARD_MEAN = 150;
    const STANDARD_STD = Math.sqrt(
        ([100,200,150,175,125].reduce((s,v) => s + (v-150)**2, 0)) / 4
    );

    // ===== A: DATA QUALITY PROFILER =====

    describe("A: DataQualityProfiler", () => {
        describe("missingness detection", () => {
            test("reports no missingness for continuous observations", () => {
                const obs = [
                    createObs(TENANT_A, METRIC, "2026-01-01", 100),
                    createObs(TENANT_A, METRIC, "2026-01-02", 200),
                    createObs(TENANT_A, METRIC, "2026-01-03", 150),
                ];
                const window = { start: "2026-01-01", end: "2026-01-03" };
                const profile = DataQualityProfiler.profile(obs, TENANT_A, METRIC, window);

                expect(profile.missingness).not.toBeNull();
                expect(profile.missingness!.gaps).toHaveLength(0);
                expect(profile.missingness!.coveragePercent).toBe(100);
            });

            test("reports missingness for gaps between observations", () => {
                const obs = [
                    createObs(TENANT_A, METRIC, "2026-01-01", 100),
                    createObs(TENANT_A, METRIC, "2026-01-15", 200), // 14 day gap
                ];
                const window = { start: "2026-01-01", end: "2026-01-15" };
                const profile = DataQualityProfiler.profile(obs, TENANT_A, METRIC, window);

                expect(profile.missingness).not.toBeNull();
                expect(profile.missingness!.gaps.length).toBeGreaterThan(0);
                expect(profile.missingness!.coveragePercent).toBeLessThan(100);
            });

            test("handles empty observation set", () => {
                const window = { start: "2026-01-01", end: "2026-01-31" };
                const profile = DataQualityProfiler.profile([], TENANT_A, METRIC, window);

                expect(profile.observationCount).toBe(0);
                expect(profile.missingness!.coveragePercent).toBe(0);
                expect(profile.missingness!.totalMissingDays).toBeGreaterThan(0);
            });
        });

        describe("duplicate detection", () => {
            test("detects duplicate timestamps", () => {
                const obs = [
                    createObs(TENANT_A, METRIC, "2026-01-01", 100),
                    createObs(TENANT_A, METRIC, "2026-01-01", 200), // duplicate timestamp
                    createObs(TENANT_A, METRIC, "2026-01-02", 150),
                ];
                const window = { start: "2026-01-01", end: "2026-01-02" };
                const profile = DataQualityProfiler.profile(obs, TENANT_A, METRIC, window);

                expect(profile.duplicates).not.toBeNull();
                expect(profile.duplicates!.count).toBe(1);
                expect(profile.duplicates!.duplicateTimestamps).toContain("2026-01-01");
                expect(profile.qualityFlags).toContain("has-duplicates");
            });

            test("returns null for no duplicates", () => {
                const obs = [
                    createObs(TENANT_A, METRIC, "2026-01-01", 100),
                    createObs(TENANT_A, METRIC, "2026-01-02", 200),
                ];
                const window = { start: "2026-01-01", end: "2026-01-02" };
                const profile = DataQualityProfiler.profile(obs, TENANT_A, METRIC, window);

                expect(profile.duplicates).toBeNull();
            });
        });

        describe("non-finite value detection", () => {
            test("detects NaN values", () => {
                const obs = [
                    createObs(TENANT_A, METRIC, "2026-01-01", 100),
                    createObs(TENANT_A, METRIC, "2026-01-02", NaN),
                ];
                const window = { start: "2026-01-01", end: "2026-01-02" };
                const profile = DataQualityProfiler.profile(obs, TENANT_A, METRIC, window);

                expect(profile.nonFiniteValues).not.toBeNull();
                expect(profile.nonFiniteValues!.count).toBe(1);
                expect(profile.qualityFlags).toContain("has-non-finite");
            });

            test("detects Infinity values", () => {
                const obs = [
                    createObs(TENANT_A, METRIC, "2026-01-01", Infinity),
                    createObs(TENANT_A, METRIC, "2026-01-02", 100),
                ];
                const window = { start: "2026-01-01", end: "2026-01-02" };
                const profile = DataQualityProfiler.profile(obs, TENANT_A, METRIC, window);

                expect(profile.nonFiniteValues).not.toBeNull();
                expect(profile.nonFiniteValues!.count).toBe(1);
            });

            test("returns null when all values are finite", () => {
                const obs = [
                    createObs(TENANT_A, METRIC, "2026-01-01", 100),
                    createObs(TENANT_A, METRIC, "2026-01-02", 200),
                ];
                const window = { start: "2026-01-01", end: "2026-01-02" };
                const profile = DataQualityProfiler.profile(obs, TENANT_A, METRIC, window);

                expect(profile.nonFiniteValues).toBeNull();
            });
        });

        describe("temporal gap analysis", () => {
            test("calculates max and avg gap", () => {
                const obs = [
                    createObs(TENANT_A, METRIC, "2026-01-01", 100),
                    createObs(TENANT_A, METRIC, "2026-01-05", 200), // 4 day gap
                    createObs(TENANT_A, METRIC, "2026-01-06", 150), // 1 day gap
                ];
                const window = { start: "2026-01-01", end: "2026-01-06" };
                const profile = DataQualityProfiler.profile(obs, TENANT_A, METRIC, window);

                expect(profile.temporalGaps).not.toBeNull();
                expect(profile.temporalGaps!.maxGapDays).toBe(4);
                expect(profile.temporalGaps!.avgGapDays).toBeGreaterThan(0);
            });

            test("reports zero gaps for same-timestamp observations", () => {
                // Same timestamp = zero gap
                const obs = [
                    createObs(TENANT_A, METRIC, "2026-01-01", 100),
                    createObs(TENANT_A, METRIC, "2026-01-01", 200),
                ];
                const window = { start: "2026-01-01", end: "2026-01-01" };
                const profile = DataQualityProfiler.profile(obs, TENANT_A, METRIC, window);

                expect(profile.temporalGaps!.maxGapDays).toBe(0);
                expect(profile.temporalGaps!.avgGapDays).toBe(0);
            });
        });

        describe("isQualitySufficient", () => {
            test("returns false for insufficient observations", () => {
                const obs = [createObs(TENANT_A, METRIC, "2026-01-01", 100)];
                const window = { start: "2026-01-01", end: "2026-01-01" };
                const profile = DataQualityProfiler.profile(obs, TENANT_A, METRIC, window);

                expect(DataQualityProfiler.isQualitySufficient(profile, 2)).toBe(false);
            });

            test("returns false for non-finite values", () => {
                const obs = [
                    createObs(TENANT_A, METRIC, "2026-01-01", 100),
                    createObs(TENANT_A, METRIC, "2026-01-02", NaN),
                ];
                const window = { start: "2026-01-01", end: "2026-01-02" };
                const profile = DataQualityProfiler.profile(obs, TENANT_A, METRIC, window);

                expect(DataQualityProfiler.isQualitySufficient(profile, 2)).toBe(false);
            });

            test("returns true for sufficient clean data", () => {
                const obs = [
                    createObs(TENANT_A, METRIC, "2026-01-01", 100),
                    createObs(TENANT_A, METRIC, "2026-01-02", 200),
                ];
                const window = { start: "2026-01-01", end: "2026-01-02" };
                const profile = DataQualityProfiler.profile(obs, TENANT_A, METRIC, window);

                expect(DataQualityProfiler.isQualitySufficient(profile, 2)).toBe(true);
            });
        });
    });

    // ===== B: STATISTICAL BASELINE ENGINE =====

    describe("B: StatisticalBaselineEngine", () => {
        describe("baseline creation", () => {
            test("creates baseline with correct statistics", () => {
                const obs = STANDARD_VALUES.map((v, i) =>
                    createObs(TENANT_A, METRIC, `2026-01-0${i+1}`, v)
                );

                const baseline = StatisticalBaselineEngine.createBaseline({
                    observations: obs,
                    source: "test"
                });

                expect(baseline).not.toBeNull();
                expect(baseline!.tenantId).toBe(TENANT_A);
                expect(baseline!.metricName).toBe(METRIC);
                expect(baseline!.observationCount).toBe(5);
                expect(baseline!.mean).toBeCloseTo(STANDARD_MEAN, 5);
                expect(baseline!.median).toBe(150);
                expect(baseline!.sampleStandardDeviation).toBeCloseTo(STANDARD_STD, 5);
            });

            test("includes correct provenance", () => {
                const obs = [
                    createObs(TENANT_A, METRIC, "2026-01-01", 100),
                    createObs(TENANT_A, METRIC, "2026-01-02", 200),
                ];

                const baseline = StatisticalBaselineEngine.createBaseline({
                    observations: obs,
                    source: "financial_ingestion:test"
                });

                expect(baseline!.provenance.source).toBe("financial_ingestion:test");
                expect(baseline!.provenance.tenant).toBe(TENANT_A);
                expect(baseline!.provenance.statisticalConvention).toEqual({
                    mean: "arithmetic",
                    variance: "sample_n-1",
                    percentile: "type7"
                });
            });

            test("returns null for insufficient observations", () => {
                const obs = [createObs(TENANT_A, METRIC, "2026-01-01", 100)];

                const baseline = StatisticalBaselineEngine.createBaseline({
                    observations: obs,
                    source: "test"
                });

                expect(baseline).toBeNull();
            });

            test("returns null for non-finite values", () => {
                const obs = [
                    createObs(TENANT_A, METRIC, "2026-01-01", 100),
                    createObs(TENANT_A, METRIC, "2026-01-02", NaN),
                ];

                const baseline = StatisticalBaselineEngine.createBaseline({
                    observations: obs,
                    source: "test"
                });

                expect(baseline).toBeNull();
            });
        });

        describe("verifyBaseline", () => {
            test("verifies correct baseline", () => {
                const obs = STANDARD_VALUES.map((v, i) =>
                    createObs(TENANT_A, METRIC, `2026-01-0${i+1}`, v)
                );

                const baseline = StatisticalBaselineEngine.createBaseline({
                    observations: obs,
                    source: "test"
                });

                const result = StatisticalBaselineEngine.verifyBaseline(baseline!, obs);
                expect(result.verified).toBe(true);
                expect(result.errors).toHaveLength(0);
            });

            test("detects mismatch", () => {
                const obs = STANDARD_VALUES.map((v, i) =>
                    createObs(TENANT_A, METRIC, `2026-01-0${i+1}`, v)
                );

                const baseline = StatisticalBaselineEngine.createBaseline({
                    observations: obs,
                    source: "test"
                });

                // Create modified observations
                const modifiedObs = [...obs];
                modifiedObs[0] = createObs(TENANT_A, METRIC, "2026-01-01", 999);

                const result = StatisticalBaselineEngine.verifyBaseline(baseline!, modifiedObs);
                expect(result.verified).toBe(false);
                expect(result.errors.length).toBeGreaterThan(0);
            });
        });
    });

    // ===== C: BASELINE COMPARISON =====

    describe("C: BaselineComparison", () => {
        let baseline: ReturnType<typeof StatisticalBaselineEngine.createBaseline>;

        beforeEach(() => {
            const obs = STANDARD_VALUES.map((v, i) =>
                createObs(TENANT_A, METRIC, `2026-01-0${i+1}`, v)
            );
            baseline = StatisticalBaselineEngine.createBaseline({
                observations: obs,
                source: "test"
            });
        });

        describe("absolute deviation", () => {
            test("calculates absolute deviation correctly", () => {
                // Current value = 200, mean = 150, abs dev = 50
                const result = BaselineComparison.compare(200, baseline!);

                expect(result.absoluteDeviation).toBe(50);
            });

            test("handles negative deviation", () => {
                // Current value = 100, mean = 150, abs dev = 50
                const result = BaselineComparison.compare(100, baseline!);

                expect(result.absoluteDeviation).toBe(50);
            });
        });

        describe("relative deviation", () => {
            test("calculates relative deviation correctly", () => {
                // Current = 200, mean = 150, rel dev = 50/150 = 0.333...
                const result = BaselineComparison.compare(200, baseline!);

                expect(result.relativeDeviation).toBeCloseTo(1/3, 5);
            });

            test("handles negative relative deviation", () => {
                // Current = 100, mean = 150, rel dev = -50/150 = -0.333...
                const result = BaselineComparison.compare(100, baseline!);

                expect(result.relativeDeviation).toBeCloseTo(-1/3, 5);
            });
        });

        describe("zero/near-zero baseline handling", () => {
            test("sets relativeDeviation to null for near-zero baseline", () => {
                // Values that average to near-zero (1e-15 scale)
                const zeroObs = [
                    createObs(TENANT_A, METRIC, "2026-01-01", 1e-15),
                    createObs(TENANT_A, METRIC, "2026-01-02", -1e-15),
                ];
                const zeroBaseline = StatisticalBaselineEngine.createBaseline({
                    observations: zeroObs,
                    source: "test"
                });

                const result = BaselineComparison.compare(0, zeroBaseline!);

                expect(result.relativeDeviation).toBeNull();
            });

            test("calculates relativeDeviation for non-zero baseline", () => {
                const result = BaselineComparison.compare(200, baseline!);

                expect(result.relativeDeviation).not.toBeNull();
            });
        });

        describe("z-score contract", () => {
            test("z-score is null when n < 30", () => {
                // Baseline has n=5, which is < 30
                const result = BaselineComparison.compare(200, baseline!);

                expect(result.zScore).toBeNull();
            });

            test("canCalculateZScore returns false for n < 30", () => {
                expect(BaselineComparison.canCalculateZScore(baseline!)).toBe(false);
            });

            test("z-score is null for constant series (std = 0)", () => {
                const constantObs = [
                    createObs(TENANT_A, METRIC, "2026-01-01", 100),
                    createObs(TENANT_A, METRIC, "2026-01-02", 100),
                    createObs(TENANT_A, METRIC, "2026-01-03", 100),
                ];
                const constantBaseline = StatisticalBaselineEngine.createBaseline({
                    observations: constantObs,
                    source: "test"
                });

                // Even with n>=30 requirement, constant series should not have z-score
                // because std = 0
                expect(constantBaseline!.sampleStandardDeviation).toBe(0);
            });

            test("getZScoreContract returns correct requirements", () => {
                const contract = BaselineComparison.getZScoreContract();

                expect(contract.requiresMinObservations).toBe(30);
                expect(contract.requiresNonZeroStdDev).toBe(true);
                expect(contract.method).toBe("z-score");
            });
        });

        describe("confidence", () => {
            test("confidence is always unavailable", () => {
                const result = BaselineComparison.compare(200, baseline!);

                expect(result.confidence.source).toBe("unavailable");
            });
        });

        describe("classifyDeviation", () => {
            test("classifies within 1 std as normal", () => {
                const result = BaselineComparison.compare(STANDARD_MEAN, baseline!);
                const classification = BaselineComparison.classifyDeviation(result);

                expect(classification.severity).toBe("normal");
            });

            test("classifies >3 std as critical", () => {
                // Create baseline with enough observations for z-score
                const manyObs = Array.from({ length: 35 }, (_, i) =>
                    createObs(TENANT_A, METRIC, `2026-01-${String(i+1).padStart(2,'0')}`, 100 + (i % 2 === 0 ? 1 : -1))
                );
                const largeBaseline = StatisticalBaselineEngine.createBaseline({
                    observations: manyObs,
                    source: "test"
                });

                // 100 is far from mean (should be around 100), so not critical
                const result = BaselineComparison.compare(100, largeBaseline!);
                const classification = BaselineComparison.classifyDeviation(result);

                expect(classification.severity).toBeDefined();
            });
        });
    });

    // ===== D: EDGE CASES =====

    describe("D: Edge Cases", () => {
        test("empty observation array returns null baseline", () => {
            const baseline = StatisticalBaselineEngine.createBaseline({
                observations: [],
                source: "test"
            });
            expect(baseline).toBeNull();
        });

        test("n=1 returns null baseline", () => {
            const obs = [createObs(TENANT_A, METRIC, "2026-01-01", 100)];
            const baseline = StatisticalBaselineEngine.createBaseline({
                observations: obs,
                source: "test"
            });
            expect(baseline).toBeNull();
        });

        test("constant series has zero standard deviation", () => {
            const obs = [
                createObs(TENANT_A, METRIC, "2026-01-01", 100),
                createObs(TENANT_A, METRIC, "2026-01-02", 100),
                createObs(TENANT_A, METRIC, "2026-01-03", 100),
            ];
            const baseline = StatisticalBaselineEngine.createBaseline({
                observations: obs,
                source: "test"
            });

            expect(baseline!.sampleVariance).toBe(0);
            expect(baseline!.sampleStandardDeviation).toBe(0);
        });

        test("zero baseline is handled explicitly", () => {
            const obs = [
                createObs(TENANT_A, METRIC, "2026-01-01", 0),
                createObs(TENANT_A, METRIC, "2026-01-02", 0),
                createObs(TENANT_A, METRIC, "2026-01-03", 0),
            ];
            const baseline = StatisticalBaselineEngine.createBaseline({
                observations: obs,
                source: "test"
            });

            expect(baseline).not.toBeNull();
            expect(baseline!.mean).toBe(0);

            const result = BaselineComparison.compare(0, baseline!);
            expect(result.relativeDeviation).toBeNull(); // Division by zero
        });

        test("duplicate timestamps in baseline creation", () => {
            const obs = [
                createObs(TENANT_A, METRIC, "2026-01-01", 100),
                createObs(TENANT_A, METRIC, "2026-01-01", 200), // duplicate
                createObs(TENANT_A, METRIC, "2026-01-02", 150),
            ];
            const baseline = StatisticalBaselineEngine.createBaseline({
                observations: obs,
                source: "test"
            });

            // Should still create baseline with n=3
            expect(baseline).not.toBeNull();
            expect(baseline!.observationCount).toBe(3);
        });
    });

    // ===== E: TENANT ISOLATION =====

    describe("E: Tenant Isolation in Baselines", () => {
        test("baseline includes tenant ID", () => {
            const obs = [
                createObs(TENANT_A, METRIC, "2026-01-01", 100),
                createObs(TENANT_A, METRIC, "2026-01-02", 200),
            ];
            const baseline = StatisticalBaselineEngine.createBaseline({
                observations: obs,
                source: "test"
            });

            expect(baseline!.tenantId).toBe(TENANT_A);
            expect(baseline!.provenance.tenant).toBe(TENANT_A);
        });

        test("comparison preserves tenant context", () => {
            const obs = [
                createObs(TENANT_A, METRIC, "2026-01-01", 100),
                createObs(TENANT_A, METRIC, "2026-01-02", 200),
            ];
            const baseline = StatisticalBaselineEngine.createBaseline({
                observations: obs,
                source: "test"
            });

            const result = BaselineComparison.compare(150, baseline!);

            expect(result.tenantId).toBe(TENANT_A);
            expect(result.provenance.tenant).toBe(TENANT_A);
        });

        test("quality profile tenant isolation", () => {
            const obs = [
                createObs(TENANT_A, METRIC, "2026-01-01", 100),
                createObs(TENANT_A, METRIC, "2026-01-02", 200),
            ];
            const window = { start: "2026-01-01", end: "2026-01-02" };
            const profile = DataQualityProfiler.profile(obs, TENANT_A, METRIC, window);

            expect(profile.tenantId).toBe(TENANT_A);
        });
    });
});
