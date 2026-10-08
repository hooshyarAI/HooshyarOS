/**
 * Stage 07-D.B - Empirical Prediction Interval Tests
 *
 * Focused tests for:
 * 1. Empirical quantile interval calculation
 * 2. Asymmetric intervals (skewed residuals)
 * 3. Exact known vector (hand-verified)
 * 4. Coverage handling
 * 5. Insufficient-data behavior
 * 6. Invalid input (coverage, forecast, NaN, Infinity)
 * 7. Provenance completeness
 * 8. Leakage status (no future-data access)
 * 9. Tenant isolation
 * 10. Deterministic repeated execution
 * 11. Interval ordering (lower <= upper)
 * 12. Type-7 quantile correctness
 */

import { EmpiricalPredictionInterval } from "../Uncertainty/EmpiricalPredictionInterval";
import { ResidualSet, ResidualObservation } from "../Uncertainty/UncertaintyTypes";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const METRIC = "revenue";
const METHOD = "naive";

/**
 * Build a minimal residual set with the given residuals and tenant context.
 */
function buildResidualSet(
    residuals: number[],
    overrides: Partial<{
        tenantId: string;
        metricName: string;
        method: string;
    }> = {}
): ResidualSet {
    const tenantId = overrides.tenantId ?? TENANT_A;
    const metricName = overrides.metricName ?? METRIC;
    const method = overrides.method ?? METHOD;

    const observations: ResidualObservation[] = residuals.map((r, i) => {
        const date = new Date("2026-01-01");
        date.setDate(date.getDate() + i);
        return Object.freeze({
            tenantId,
            metricName,
            forecastingMethod: method,
            originTimestamp: "2025-12-31T00:00:00Z",
            forecastTimestamp: date.toISOString().split("T")[0],
            actual: 100 + r,
            prediction: 100,
            residual: r,
            splitIndex: 0,
            step: i + 1
        });
    });

    return Object.freeze({
        tenantId,
        metricName,
        method,
        observationCount: observations.length,
        finiteResidualCount: observations.length,
        residuals: Object.freeze(observations),
        provenance: Object.freeze({
            source: "test-fixture",
            tenant: tenantId,
            metric: metricName,
            method,
            backtestSplitCount: 1,
            extractedAt: "2026-01-01T00:00:00Z"
        })
    });
}

describe("Stage 07-D.B: Empirical Prediction Intervals", () => {

    // ===== Hand-verified known vector =====

    describe("Known vector [-10, -5, 0, 5, 10]", () => {
        // n=5, sorted=[-10, -5, 0, 5, 10]
        // For C=0.95: alpha=0.05, qLower=0.025, qUpper=0.975
        //   rank_low = 0.025 * 4 = 0.1, lower=0, upper=1, fraction=0.1
        //   sorted[0] + 0.1*(sorted[1]-sorted[0]) = -10 + 0.5 = -9.5
        //   rank_high = 0.975 * 4 = 3.9, lower=3, upper=4, fraction=0.9
        //   sorted[3] + 0.9*(sorted[4]-sorted[3]) = 5 + 4.5 = 9.5
        // For y_hat=100: lower=90.5, upper=109.5

        test("Type-7 quantile for C=0.95 with y_hat=100 produces [90.5, 109.5]", () => {
            const rs = buildResidualSet([-10, -5, 0, 5, 10]);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.95,
                residualSet: rs
            });

            expect(result.status).toBe("calculated");
            if (result.status !== "calculated") return;

            expect(result.interval.lowerBound).toBeCloseTo(90.5, 10);
            expect(result.interval.upperBound).toBeCloseTo(109.5, 10);
            expect(result.interval.pointForecast).toBe(100);
            expect(result.interval.confidenceLevel).toBe(0.95);
        });

        test("Type-7 quantile for C=0.50 (median) with y_hat=100", () => {
            // For C=0.50: alpha=0.5, qLower=0.25, qUpper=0.75
            //   rank_low = 0.25 * 4 = 1.0 → sorted[1] = -5
            //   rank_high = 0.75 * 4 = 3.0 → sorted[3] = 5
            // For y_hat=100: lower=95, upper=105
            const rs = buildResidualSet([-10, -5, 0, 5, 10]);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.50,
                residualSet: rs
            });

            expect(result.status).toBe("calculated");
            if (result.status !== "calculated") return;

            expect(result.interval.lowerBound).toBeCloseTo(95, 10);
            expect(result.interval.upperBound).toBeCloseTo(105, 10);
        });

        test("Type-7 quantile for C=1.0 is not allowed (invalid)", () => {
            // C must be strictly < 1
            const rs = buildResidualSet([-10, -5, 0, 5, 10]);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 1.0,
                residualSet: rs
            });

            expect(result.status).toBe("invalid_request");
        });

        test("Type-7 quantile for C=0.0 is not allowed (invalid)", () => {
            const rs = buildResidualSet([-10, -5, 0, 5, 10]);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.0,
                residualSet: rs
            });

            expect(result.status).toBe("invalid_request");
        });
    });

    // ===== Asymmetric intervals =====

    describe("Asymmetric residual distributions", () => {
        test("preserves asymmetry: positive-skewed residuals", () => {
            // Right-skewed: most residuals small, one large positive
            const residuals = [-2, -1, 0, 1, 20];
            const rs = buildResidualSet(residuals);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 50,
                coverage: 0.90,
                residualSet: rs
            });

            expect(result.status).toBe("calculated");
            if (result.status !== "calculated") return;

            // For C=0.90: alpha=0.10, qLow=0.05, qHigh=0.95
            //   rank_low = 0.05 * 4 = 0.2, lower=0, upper=1, fraction=0.2
            //   sorted[0] + 0.2*(sorted[1]-sorted[0]) = -2 + 0.2*1 = -1.8
            //   rank_high = 0.95 * 4 = 3.8, lower=3, upper=4, fraction=0.8
            //   sorted[3] + 0.8*(sorted[4]-sorted[3]) = 1 + 0.8*19 = 16.2
            // For y_hat=50: lower=48.2, upper=66.2
            expect(result.interval.lowerBound).toBeCloseTo(48.2, 10);
            expect(result.interval.upperBound).toBeCloseTo(66.2, 10);
            // Asymmetric: midpoint is NOT the point forecast
            const midpoint = (result.interval.upperBound + result.interval.lowerBound) / 2;
            const pointOffset = result.interval.pointForecast - midpoint;
            expect(Math.abs(pointOffset)).toBeGreaterThan(0.5);
        });

        test("preserves asymmetry: negative-skewed residuals", () => {
            const residuals = [-20, -1, 0, 1, 2];
            const rs = buildResidualSet(residuals);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 50,
                coverage: 0.90,
                residualSet: rs
            });

            expect(result.status).toBe("calculated");
            if (result.status !== "calculated") return;

            // For y_hat=50, lower should be much smaller than upper's distance
            const lowerDist = 50 - result.interval.lowerBound;
            const upperDist = result.interval.upperBound - 50;
            expect(lowerDist).toBeGreaterThan(upperDist);
        });
    });

    // ===== Symmetric residuals =====

    describe("Symmetric residual distributions", () => {
        test("symmetric residuals produce interval around point forecast", () => {
            const residuals = [-10, -5, 0, 5, 10];
            const rs = buildResidualSet(residuals);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.95,
                residualSet: rs
            });

            expect(result.status).toBe("calculated");
            if (result.status !== "calculated") return;

            // For y_hat=100, lower=90.5, upper=109.5
            // Type-7 with n=5 gives qLower=-9.5, qUpper=9.5
            const lowerOffset = 100 - result.interval.lowerBound;
            const upperOffset = result.interval.upperBound - 100;
            expect(lowerOffset).toBeCloseTo(9.5, 10);
            expect(upperOffset).toBeCloseTo(9.5, 10);
        });
    });

    // ===== Insufficient data =====

    describe("Insufficient residual data", () => {
        test("empty residuals → insufficient_data", () => {
            const rs = buildResidualSet([]);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.95,
                residualSet: rs
            });

            expect(result.status).toBe("insufficient_data");
        });

        test("one residual → insufficient_data", () => {
            const rs = buildResidualSet([5]);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.95,
                residualSet: rs
            });

            expect(result.status).toBe("insufficient_data");
        });

        test("two residuals → insufficient_data", () => {
            const rs = buildResidualSet([5, 10]);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.95,
                residualSet: rs
            });

            expect(result.status).toBe("insufficient_data");
        });

        test("exactly 3 residuals → sufficient (minimum threshold)", () => {
            const rs = buildResidualSet([-5, 0, 5]);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.95,
                residualSet: rs
            });

            expect(result.status).toBe("calculated");
        });

        test("missing residual set → insufficient_data", () => {
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.95,
                residualSet: null as any
            });

            expect(result.status).toBe("insufficient_data");
        });
    });

    // ===== Invalid input =====

    describe("Invalid input", () => {
        test("coverage = 0 → invalid_request", () => {
            const rs = buildResidualSet([-10, -5, 0, 5, 10]);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0,
                residualSet: rs
            });
            expect(result.status).toBe("invalid_request");
        });

        test("coverage = 1 → invalid_request", () => {
            const rs = buildResidualSet([-10, -5, 0, 5, 10]);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 1,
                residualSet: rs
            });
            expect(result.status).toBe("invalid_request");
        });

        test("coverage = -0.5 → invalid_request", () => {
            const rs = buildResidualSet([-10, -5, 0, 5, 10]);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: -0.5,
                residualSet: rs
            });
            expect(result.status).toBe("invalid_request");
        });

        test("coverage = 1.5 → invalid_request", () => {
            const rs = buildResidualSet([-10, -5, 0, 5, 10]);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 1.5,
                residualSet: rs
            });
            expect(result.status).toBe("invalid_request");
        });

        test("coverage = NaN → invalid_request", () => {
            const rs = buildResidualSet([-10, -5, 0, 5, 10]);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: NaN,
                residualSet: rs
            });
            expect(result.status).toBe("invalid_request");
        });

        test("point forecast = NaN → invalid_request", () => {
            const rs = buildResidualSet([-10, -5, 0, 5, 10]);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: NaN,
                coverage: 0.95,
                residualSet: rs
            });
            expect(result.status).toBe("invalid_request");
        });

        test("point forecast = Infinity → invalid_request", () => {
            const rs = buildResidualSet([-10, -5, 0, 5, 10]);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: Infinity,
                coverage: 0.95,
                residualSet: rs
            });
            expect(result.status).toBe("invalid_request");
        });
    });

    // ===== Special residual cases =====

    describe("Special residual distributions", () => {
        test("all-zero residuals → interval degenerates to point forecast ± 0", () => {
            const rs = buildResidualSet([0, 0, 0, 0, 0]);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.95,
                residualSet: rs
            });

            expect(result.status).toBe("calculated");
            if (result.status !== "calculated") return;

            expect(result.interval.lowerBound).toBeCloseTo(100, 10);
            expect(result.interval.upperBound).toBeCloseTo(100, 10);
        });

        test("all-identical non-zero residuals → degenerate interval", () => {
            const rs = buildResidualSet([7, 7, 7, 7, 7]);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.95,
                residualSet: rs
            });

            expect(result.status).toBe("calculated");
            if (result.status !== "calculated") return;

            expect(result.interval.lowerBound).toBeCloseTo(107, 10);
            expect(result.interval.upperBound).toBeCloseTo(107, 10);
        });
    });

    // ===== Interval ordering =====

    describe("Interval ordering (lower <= upper)", () => {
        test("always true for any valid residual distribution", () => {
            // Test with multiple distributions
            const distributions = [
                [-10, -5, 0, 5, 10],
                [10, 5, 0, -5, -10],  // reversed
                [-100, 0, 100],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
            ];

            for (const residuals of distributions) {
                const rs = buildResidualSet(residuals);
                const result = EmpiricalPredictionInterval.compute({
                    tenantId: TENANT_A,
                    metricName: METRIC,
                    forecastingMethod: METHOD,
                    forecastTimestamp: "2026-01-15",
                    step: 1,
                    pointForecast: 50,
                    coverage: 0.95,
                    residualSet: rs
                });

                if (result.status === "calculated") {
                    expect(result.interval.lowerBound).toBeLessThanOrEqual(result.interval.upperBound);
                }
            }
        });
    });

    // ===== Provenance completeness =====

    describe("Provenance and evidence", () => {
        test("calculated result includes all required provenance fields", () => {
            const rs = buildResidualSet([-10, -5, 0, 5, 10]);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.95,
                residualSet: rs
            });

            expect(result.status).toBe("calculated");
            if (result.status !== "calculated") return;

            // Tenant + metric + method
            expect(result.tenantId).toBe(TENANT_A);
            expect(result.metricName).toBe(METRIC);
            expect(result.forecastingMethod).toBe(METHOD);

            // Coverage + alpha
            expect(result.coverage).toBe(0.95);
            expect(result.alpha).toBeCloseTo(0.05, 10);

            // Residual count
            expect(result.residualCount).toBe(5);

            // Method identifier
            expect(result.method).toBe("quantile_empirical");

            // Quantile provenance
            expect(result.quantileProvenance.percentileConvention).toBe("hyndman_fan_type7");
            expect(result.quantileProvenance.qLowerPosition).toBeCloseTo(0.025, 10);
            expect(result.quantileProvenance.qUpperPosition).toBeCloseTo(0.975, 10);
            expect(result.quantileProvenance.qLower).toBeCloseTo(-9.5, 10);
            expect(result.quantileProvenance.qUpper).toBeCloseTo(9.5, 10);
            expect(result.quantileProvenance.residualCount).toBe(5);
            expect(result.quantileProvenance.allResidualsFinite).toBe(true);
            expect(result.quantileProvenance.chronologicalIntegrity).toBe(true);

            // Uncertainty provenance
            expect(result.uncertaintyProvenance.source).toBe("empirical-prediction-interval");
            expect(result.uncertaintyProvenance.tenant).toBe(TENANT_A);
            expect(result.uncertaintyProvenance.metric).toBe(METRIC);
            expect(result.uncertaintyProvenance.method).toBe(METHOD);
            expect(result.uncertaintyProvenance.residualCount).toBe(5);
            expect(result.uncertaintyProvenance.calculatedAt).toBeDefined();

            // Calibration evidence
            expect(result.calibration.method).toBe("quantile_empirical");
            expect(result.calibration.residualCount).toBe(5);
            // Mean of [-10, -5, 0, 5, 10] = 0
            expect(result.calibration.meanResidual).toBeCloseTo(0, 10);
        });
    });

    // ===== Deterministic execution =====

    describe("Deterministic repeated execution", () => {
        test("same input → identical result (bounds + provenance)", () => {
            const rs = buildResidualSet([-10, -5, 0, 5, 10]);
            const input = {
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.95,
                residualSet: rs
            };

            const r1 = EmpiricalPredictionInterval.compute(input);
            const r2 = EmpiricalPredictionInterval.compute(input);
            const r3 = EmpiricalPredictionInterval.compute(input);

            expect(r1.status).toBe("calculated");
            expect(r2.status).toBe("calculated");
            expect(r3.status).toBe("calculated");
            if (r1.status !== "calculated" || r2.status !== "calculated" || r3.status !== "calculated") return;

            // Bounds must be identical
            expect(r2.interval.lowerBound).toBe(r1.interval.lowerBound);
            expect(r2.interval.upperBound).toBe(r1.interval.upperBound);
            expect(r3.interval.lowerBound).toBe(r1.interval.lowerBound);
            expect(r3.interval.upperBound).toBe(r1.interval.upperBound);

            // Quantiles must be identical
            expect(r2.quantileProvenance.qLower).toBe(r1.quantileProvenance.qLower);
            expect(r2.quantileProvenance.qUpper).toBe(r1.quantileProvenance.qUpper);
            expect(r3.quantileProvenance.qLower).toBe(r1.quantileProvenance.qLower);
            expect(r3.quantileProvenance.qUpper).toBe(r1.quantileProvenance.qUpper);

            // Alpha must be identical
            expect(r2.alpha).toBe(r1.alpha);
            expect(r3.alpha).toBe(r1.alpha);
        });

        test("100 repeated calls produce 100 identical results", () => {
            const rs = buildResidualSet([-10, -5, 0, 5, 10]);
            const input = {
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.95,
                residualSet: rs
            };

            const first = EmpiricalPredictionInterval.compute(input);
            expect(first.status).toBe("calculated");
            if (first.status !== "calculated") return;

            const firstLower = first.interval.lowerBound;
            const firstUpper = first.interval.upperBound;

            for (let i = 0; i < 100; i++) {
                const r = EmpiricalPredictionInterval.compute(input);
                expect(r.status).toBe("calculated");
                if (r.status !== "calculated") return;
                expect(r.interval.lowerBound).toBe(firstLower);
                expect(r.interval.upperBound).toBe(firstUpper);
            }
        });
    });

    // ===== Tenant isolation =====

    describe("Tenant isolation", () => {
        test("tenant A and tenant B results are independent", () => {
            const rsA = buildResidualSet([-10, -5, 0, 5, 10], { tenantId: TENANT_A });
            const rsB = buildResidualSet([-20, -10, 0, 10, 20], { tenantId: TENANT_B });

            const rA = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.95,
                residualSet: rsA
            });

            const rB = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_B,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.95,
                residualSet: rsB
            });

            expect(rA.status).toBe("calculated");
            expect(rB.status).toBe("calculated");
            if (rA.status !== "calculated" || rB.status !== "calculated") return;

            // Different intervals (tenant B has wider spread)
            expect(rA.interval.upperBound - rA.interval.lowerBound)
                .toBeLessThan(rB.interval.upperBound - rB.interval.lowerBound);

            // Different tenantId in provenance
            expect(rA.tenantId).toBe(TENANT_A);
            expect(rB.tenantId).toBe(TENANT_B);
        });

        test("result does not include other tenant's residuals", () => {
            const rsA = buildResidualSet([-10, -5, 0, 5, 10], { tenantId: TENANT_A });
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.95,
                residualSet: rsA
            });

            expect(result.status).toBe("calculated");
            if (result.status !== "calculated") return;

            // Provenance only references tenant A
            expect(result.tenantId).toBe(TENANT_A);
            expect(result.uncertaintyProvenance.tenant).toBe(TENANT_A);
            expect(result.residualCount).toBe(5);
        });
    });

    // ===== Leakage status =====

    describe("Leakage status (no future-data access)", () => {
        test("interval calculation does not depend on forecastTimestamp", () => {
            // Same residuals, different timestamps → same interval bounds
            const rs = buildResidualSet([-10, -5, 0, 5, 10]);

            const r1 = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.95,
                residualSet: rs
            });

            const r2 = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-12-31",
                step: 99,
                pointForecast: 100,
                coverage: 0.95,
                residualSet: rs
            });

            expect(r1.status).toBe("calculated");
            expect(r2.status).toBe("calculated");
            if (r1.status !== "calculated" || r2.status !== "calculated") return;

            // Bounds depend only on residuals + forecast + coverage
            expect(r1.interval.lowerBound).toBe(r2.interval.lowerBound);
            expect(r1.interval.upperBound).toBe(r2.interval.upperBound);
        });

        test("interval calculation does not read residuals past the calibration set", () => {
            // The ResidualSet is the only data source for residuals.
            // Pass a set with exactly 5 residuals and verify only those 5 are used.
            const exactResiduals = [-3, -1, 0, 1, 3];
            const rs = buildResidualSet(exactResiduals);
            const result = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.95,
                residualSet: rs
            });

            expect(result.status).toBe("calculated");
            if (result.status !== "calculated") return;

            // The interval reflects ONLY the 5 provided residuals
            // For y_hat=100, n=5, C=0.95:
            //   rank_low = 0.025 * 4 = 0.1, lower=0, upper=1, fraction=0.1
            //   sorted[0] + 0.1*(sorted[1]-sorted[0]) = -3 + 0.1*2 = -2.8
            //   rank_high = 0.975 * 4 = 3.9, lower=3, upper=4, fraction=0.9
            //   sorted[3] + 0.9*(sorted[4]-sorted[3]) = 1 + 0.9*2 = 2.8
            // For y_hat=100: lower=97.2, upper=102.8
            expect(result.interval.lowerBound).toBeCloseTo(97.2, 10);
            expect(result.interval.upperBound).toBeCloseTo(102.8, 10);
            expect(result.residualCount).toBe(5);
        });
    });

    // ===== Different coverage levels =====

    describe("Different coverage levels", () => {
        test("higher coverage produces wider interval", () => {
            const rs = buildResidualSet([-10, -5, 0, 5, 10]);

            const r50 = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.50,
                residualSet: rs
            });

            const r95 = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.95,
                residualSet: rs
            });

            expect(r50.status).toBe("calculated");
            expect(r95.status).toBe("calculated");
            if (r50.status !== "calculated" || r95.status !== "calculated") return;

            const width50 = r50.interval.upperBound - r50.interval.lowerBound;
            const width95 = r95.interval.upperBound - r95.interval.lowerBound;

            expect(width95).toBeGreaterThan(width50);
        });

        test("coverage 0.99 is narrower than coverage 0.999 (smaller alpha = more extreme quantiles)", () => {
            const rs = buildResidualSet([-10, -5, 0, 5, 10]);

            const r99 = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.99,
                residualSet: rs
            });

            const r999 = EmpiricalPredictionInterval.compute({
                tenantId: TENANT_A,
                metricName: METRIC,
                forecastingMethod: METHOD,
                forecastTimestamp: "2026-01-15",
                step: 1,
                pointForecast: 100,
                coverage: 0.999,
                residualSet: rs
            });

            expect(r99.status).toBe("calculated");
            expect(r999.status).toBe("calculated");
            if (r99.status !== "calculated" || r999.status !== "calculated") return;

            const width99 = r99.interval.upperBound - r99.interval.lowerBound;
            const width999 = r999.interval.upperBound - r999.interval.lowerBound;
            expect(width999).toBeGreaterThanOrEqual(width99);
        });
    });

    // ===== Horizon computation =====

    describe("Multi-step horizon", () => {
        test("computeForHorizon returns interval for each forecast point", () => {
            const rs = buildResidualSet([-10, -5, 0, 5, 10]);
            const forecasts = [
                { timestamp: "2026-01-10", value: 100 },
                { timestamp: "2026-01-11", value: 102 },
                { timestamp: "2026-01-12", value: 98 }
            ];

            const result = EmpiricalPredictionInterval.computeForHorizon(
                TENANT_A, METRIC, METHOD,
                forecasts, 0.95, rs
            );

            expect(result.status).toBe("calculated");
            expect(result.horizon).toBe(3);
            expect(result.intervals.length).toBe(3);
            expect(result.intervals[0].pointForecast).toBe(100);
            expect(result.intervals[1].pointForecast).toBe(102);
            expect(result.intervals[2].pointForecast).toBe(98);
            // Bounds differ because point forecasts differ
            // intervals[0] = 100 + q → lowerBound = 100 + (-9.5) = 90.5
            // intervals[1] = 102 + q → lowerBound = 102 + (-9.5) = 92.5
            // intervals[2] = 98 + q → lowerBound = 98 + (-9.5) = 88.5
            expect(result.intervals[0].lowerBound).toBeCloseTo(90.5, 10);
            expect(result.intervals[1].lowerBound).toBeCloseTo(92.5, 10);
            expect(result.intervals[2].lowerBound).toBeCloseTo(88.5, 10);
            // Same width across all (same residuals, same coverage)
            const width0 = result.intervals[0].upperBound - result.intervals[0].lowerBound;
            const width1 = result.intervals[1].upperBound - result.intervals[1].lowerBound;
            expect(width0).toBeCloseTo(width1, 10);
        });
    });
});
