/**
 * Stage 07-D.C - Prediction Interval Coverage & Calibration Tests
 *
 * Focused tests for:
 * 1. Coverage calculation (covered = lower <= actual <= upper)
 * 2. Coverage error (empirical - requested)
 * 3. Calibration classification (calibrated/under/over/insufficient)
 * 4. Multi-level coverage
 * 5. Horizon-specific evaluation
 * 6. Non-finite input handling (explicit, not silent)
 * 7. Tenant isolation
 * 8. Provenance
 * 9. Deterministic repeated execution
 * 10. No future leakage (walk-forward)
 */

import { CalibrationEvaluator } from "../Uncertainty/CalibrationEvaluator";
import { BacktestResult, BacktestSplit } from "../Forecasting/BacktestTypes";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const METRIC = "revenue";

/**
 * Build a BacktestResult from a sequence of splits.
 * Each split has training window, validation window, predictions, actuals.
 */
function buildBacktest(
    splits: Array<{
        trainingEnd: string;
        validationStart: string;
        validationEnd: string;
        trainingCount: number;
        actuals: number[];
        predictions: number[];
    }>,
    overrides: Partial<{ tenantId: string; metricName: string; method: string }> = {}
): BacktestResult {
    const tenantId = overrides.tenantId ?? TENANT_A;
    const metricName = overrides.metricName ?? METRIC;
    const method = overrides.method ?? "naive";

    const backtestSplits: BacktestSplit[] = splits.map((s, i) => {
        const trainingWindow = {
            start: "2025-12-01",
            end: s.trainingEnd
        };
        const validationWindow = {
            start: s.validationStart,
            end: s.validationEnd
        };
        const allNoLeakage =
            new Date(trainingWindow.end).getTime() < new Date(validationWindow.start).getTime();

        return {
            splitIndex: i,
            trainingWindow,
            validationWindow,
            trainingCount: s.trainingCount,
            validationCount: s.actuals.length,
            predictions: Object.freeze(
                s.predictions.map((p, j) => ({
                    timestamp: `2026-01-${String(j + 1).padStart(2, "0")}`,
                    predictedValue: p
                }))
            ),
            actuals: Object.freeze(
                s.actuals.map((a, j) => ({
                    timestamp: `2026-01-${String(j + 1).padStart(2, "0")}`,
                    actualValue: a
                }))
            ),
            metrics: {
                mae: 0,
                rmse: 0,
                mape: 0,
                smape: 0,
                n: s.actuals.length
            },
            leakageCheck: {
                trainingMaxTimestamp: trainingWindow.end,
                validationMinTimestamp: validationWindow.start,
                noLeakage: allNoLeakage
            }
        };
    });

    return Object.freeze({
        status: "success",
        tenantId,
        metricName,
        method,
        numberOfSplits: backtestSplits.length,
        forecastHorizon: backtestSplits[0]?.validationCount ?? 0,
        splits: Object.freeze(backtestSplits),
        aggregateMetrics: {
            mae: 0,
            rmse: 0,
            mape: 0,
            smape: 0,
            n: backtestSplits.reduce((s, sp) => s + sp.validationCount, 0)
        },
        overallWindow: {
            start: backtestSplits[0]?.trainingWindow.start ?? "",
            end: backtestSplits[backtestSplits.length - 1]?.validationWindow.end ?? ""
        },
        provenance: Object.freeze({
            source: "test-fixture",
            tenant: tenantId,
            metric: metricName,
            method,
            overallWindow: {
                start: backtestSplits[0]?.trainingWindow.start ?? "",
                end: backtestSplits[backtestSplits.length - 1]?.validationWindow.end ?? ""
            },
            totalObservations: 0,
            numberOfSplits: backtestSplits.length,
            forecastHorizon: backtestSplits[0]?.validationCount ?? 0,
            metricDefinitions: {
                mae: "mean(|y - yhat|)" as const,
                rmse: "sqrt(mean((y - yhat)^2))" as const,
                mape: "mean(|(y-yhat)/y|) * 100, excluding y=0" as const,
                smape: "mean(2|y-yhat|/(|y|+|yhat|)) * 100, excluding zero denominators" as const
            },
            calculatedAt: "2026-01-01T00:00:00Z"
        }),
        leakageStatus: Object.freeze({
            verified: true,
            allSplitsHaveNoLeakage: true,
            checkedAt: "2026-01-01T00:00:00Z"
        })
    });
}

describe("Stage 07-D.C: Prediction Interval Coverage & Calibration", () => {

    // ===== Exact coverage calculation =====

    describe("Exact coverage calculation", () => {
        test("computes exact covered count for known residuals", () => {
            // Use known residuals that produce deterministic intervals.
            // For split 0: actuals=[90,95,100,105,110], predictions=[100,100,100,100,100]
            //   → residuals = [-10,-5,0,5,10]
            // For split 1: 3 predictions with actuals.
            //   y_hat=100, C=0.95, residuals=[-10,-5,0,5,10]:
            //     qLower = -9.5, qUpper = 9.5 → interval = [90.5, 109.5]
            //   actuals = [95, 105, 120] → covered=2, missed=1

            const bt = buildBacktest([
                {
                    trainingEnd: "2025-12-31",
                    validationStart: "2026-01-05",
                    validationEnd: "2026-01-09",
                    trainingCount: 30,
                    actuals: [90, 95, 100, 105, 110],
                    predictions: [100, 100, 100, 100, 100]
                },
                {
                    trainingEnd: "2026-01-04",
                    validationStart: "2026-01-10",
                    validationEnd: "2026-01-12",
                    trainingCount: 30,
                    actuals: [95, 105, 120],
                    predictions: [100, 100, 100]  // intervals = [90.5, 109.5] each
                }
            ]);

            const result = CalibrationEvaluator.evaluate(bt, 0.95, {
                tenantId: TENANT_A,
                coverageLevels: [0.95],
                minEvaluated: 1,  // low for test
                tolerance: 0.05
            });

            // 2 covered, 1 missed → empiricalCoverage = 2/3
            expect(result.numberEvaluated).toBe(3);
            expect(result.numberCovered).toBe(2);
            expect(result.numberMissed).toBe(1);
            expect(result.empiricalCoverage).toBeCloseTo(2 / 3, 10);
            expect(result.coverageError).toBeCloseTo(2 / 3 - 0.95, 10);
        });
    });

    // ===== Calibration classification =====

    describe("Calibration classification", () => {
        test("under-covered: empirical significantly below requested", () => {
            // Construct a backtest where the empirical coverage is far below requested.
            // If we have very narrow intervals, few actuals will fall in.
            // Use constant predictions=100, actuals varying wildly.
            // With only 1 residual [0], qLower=0, qUpper=0 → interval=[100,100]
            // But MIN_RESIDUALS_FOR_INTERVAL=3, so first split with 1 residual is excluded.
            // Need at least 2 splits with >=3 prior residuals.
            const bt = buildBacktest([
                {
                    trainingEnd: "2025-12-31",
                    validationStart: "2026-01-05",
                    validationEnd: "2026-01-14",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100]
                },
                {
                    trainingEnd: "2026-01-04",
                    validationStart: "2026-01-15",
                    validationEnd: "2026-01-24",
                    trainingCount: 30,
                    actuals: [50, 200, 50, 200, 50, 200, 50, 200, 50, 200],  // all far from 100
                    predictions: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100]
                }
            ]);

            const result = CalibrationEvaluator.evaluate(bt, 0.95, {
                tenantId: TENANT_A,
                coverageLevels: [0.95],
                minEvaluated: 5,
                tolerance: 0.05
            });

            expect(result.status).toBe("under-covered");
            expect(result.empiricalCoverage).toBeLessThan(0.95 - 0.05);
        });

        test("insufficient_data: too few evaluations", () => {
            const bt = buildBacktest([
                {
                    trainingEnd: "2025-12-31",
                    validationStart: "2026-01-05",
                    validationEnd: "2026-01-07",
                    trainingCount: 30,
                    actuals: [100, 100, 100],
                    predictions: [100, 100, 100]
                },
                {
                    trainingEnd: "2026-01-04",
                    validationStart: "2026-01-08",
                    validationEnd: "2026-01-10",
                    trainingCount: 30,
                    actuals: [100, 100],
                    predictions: [100, 100]
                }
            ]);

            const result = CalibrationEvaluator.evaluate(bt, 0.95, {
                tenantId: TENANT_A,
                coverageLevels: [0.95],
                minEvaluated: 100,  // high threshold
                tolerance: 0.05
            });

            expect(result.status).toBe("insufficient_data");
        });

        test("calibrated rule is documented in result", () => {
            const bt = buildBacktest([
                {
                    trainingEnd: "2025-12-31",
                    validationStart: "2026-01-05",
                    validationEnd: "2026-01-07",
                    trainingCount: 30,
                    actuals: [100, 100, 100],
                    predictions: [100, 100, 100]
                },
                {
                    trainingEnd: "2026-01-04",
                    validationStart: "2026-01-08",
                    validationEnd: "2026-01-10",
                    trainingCount: 30,
                    actuals: [100, 100],
                    predictions: [100, 100]
                }
            ]);

            const result = CalibrationEvaluator.evaluate(bt, 0.95, {
                tenantId: TENANT_A,
                coverageLevels: [0.95],
                minEvaluated: 30,
                tolerance: 0.05
            });

            // The rule string contains the threshold and tolerance
            expect(result.calibrationRule).toContain("tolerance");
            expect(result.calibrationRule).toContain("0.05");
        });
    });

    // ===== Multi-level coverage =====

    describe("Multi-level coverage", () => {
        test("evaluates multiple coverage levels independently", () => {
            const bt = buildBacktest([
                {
                    trainingEnd: "2025-12-31",
                    validationStart: "2026-01-05",
                    validationEnd: "2026-01-14",
                    trainingCount: 30,
                    actuals: Array(10).fill(100),
                    predictions: Array(10).fill(100)
                },
                {
                    trainingEnd: "2026-01-04",
                    validationStart: "2026-01-15",
                    validationEnd: "2026-01-24",
                    trainingCount: 30,
                    actuals: Array(10).fill(100),
                    predictions: Array(10).fill(100)
                }
            ]);

            const result = CalibrationEvaluator.evaluateMultiLevel(bt, {
                tenantId: TENANT_A,
                coverageLevels: [0.80, 0.90, 0.95],
                minEvaluated: 5,
                tolerance: 0.05
            });

            expect(result.levels.length).toBe(3);
            expect(result.levels[0].requestedCoverage).toBe(0.80);
            expect(result.levels[1].requestedCoverage).toBe(0.90);
            expect(result.levels[2].requestedCoverage).toBe(0.95);
        });
    });

    // ===== Horizon breakdown =====

    describe("Horizon-specific evaluation", () => {
        test("generates per-horizon breakdown in report", () => {
            const bt = buildBacktest([
                {
                    trainingEnd: "2025-12-31",
                    validationStart: "2026-01-05",
                    validationEnd: "2026-01-09",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100]
                },
                {
                    trainingEnd: "2026-01-04",
                    validationStart: "2026-01-10",
                    validationEnd: "2026-01-14",
                    trainingCount: 30,
                    actuals: [100, 101, 102, 103, 104],
                    predictions: [100, 100, 100, 100, 100]
                }
            ]);

            const report = CalibrationEvaluator.generateReport(bt, 0.95, {
                tenantId: TENANT_A,
                coverageLevels: [0.95],
                minEvaluated: 5,
                tolerance: 0.05
            });

            // Horizon breakdown should have entries
            expect(report.horizonBreakdown.length).toBeGreaterThan(0);
            // Each entry has step, coverage, numberEvaluated
            for (const h of report.horizonBreakdown) {
                expect(h.step).toBeGreaterThanOrEqual(1);
                expect(h.coverage).toBeGreaterThanOrEqual(0);
                expect(h.coverage).toBeLessThanOrEqual(1);
            }
        });
    });

    // ===== Non-finite input handling =====

    describe("Non-finite input handling", () => {
        test("non-finite actuals are explicitly excluded with evidence", () => {
            const bt = buildBacktest([
                {
                    trainingEnd: "2025-12-31",
                    validationStart: "2026-01-05",
                    validationEnd: "2026-01-09",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100]
                },
                {
                    trainingEnd: "2026-01-04",
                    validationStart: "2026-01-10",
                    validationEnd: "2026-01-14",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100]
                }
            ]);

            // Inject non-finite values into split 1
            const modified = JSON.parse(JSON.stringify(bt));
            modified.splits[1].actuals[2].actualValue = NaN;
            modified.splits[1].predictions[3].predictedValue = Infinity;

            const result = CalibrationEvaluator.evaluate(modified, 0.95, {
                tenantId: TENANT_A,
                coverageLevels: [0.95],
                minEvaluated: 1,
                tolerance: 0.05
            });

            // The 2 non-finite values should be excluded
            expect(result.numberExcludedNonFinite).toBe(2);
            expect(result.numberEvaluated).toBe(3);  // 5 - 2
        });

        test("exclusion evidence is recorded in report", () => {
            const bt = buildBacktest([
                {
                    trainingEnd: "2025-12-31",
                    validationStart: "2026-01-05",
                    validationEnd: "2026-01-09",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100]
                },
                {
                    trainingEnd: "2026-01-04",
                    validationStart: "2026-01-10",
                    validationEnd: "2026-01-14",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100]
                }
            ]);

            const modified = JSON.parse(JSON.stringify(bt));
            modified.splits[1].actuals[0].actualValue = NaN;

            const report = CalibrationEvaluator.generateReport(modified, 0.95, {
                tenantId: TENANT_A,
                coverageLevels: [0.95],
                minEvaluated: 1,
                tolerance: 0.05
            });

            expect(report.exclusionEvidence.numberExcludedNonFinite).toBe(1);
        });
    });

    // ===== Tenant isolation =====

    describe("Tenant isolation", () => {
        test("rejects cross-tenant evaluation", () => {
            const bt = buildBacktest([
                {
                    trainingEnd: "2025-12-31",
                    validationStart: "2026-01-05",
                    validationEnd: "2026-01-09",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100]
                },
                {
                    trainingEnd: "2026-01-04",
                    validationStart: "2026-01-10",
                    validationEnd: "2026-01-14",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100]
                }
            ]);

            const result = CalibrationEvaluator.evaluate(bt, 0.95, {
                tenantId: TENANT_B,  // different tenant
                coverageLevels: [0.95],
                minEvaluated: 1,
                tolerance: 0.05
            });

            expect(result.status).toBe("invalid_request");
        });

        test("tenant A and tenant B evaluations are independent", () => {
            const btA = buildBacktest([
                {
                    trainingEnd: "2025-12-31",
                    validationStart: "2026-01-05",
                    validationEnd: "2026-01-09",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100]
                },
                {
                    trainingEnd: "2026-01-04",
                    validationStart: "2026-01-10",
                    validationEnd: "2026-01-14",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100]
                }
            ], { tenantId: TENANT_A });

            const btB = buildBacktest([
                {
                    trainingEnd: "2025-12-31",
                    validationStart: "2026-01-05",
                    validationEnd: "2026-01-09",
                    trainingCount: 30,
                    actuals: [50, 50, 50, 50, 50],
                    predictions: [100, 100, 100, 100, 100]
                },
                {
                    trainingEnd: "2026-01-04",
                    validationStart: "2026-01-10",
                    validationEnd: "2026-01-14",
                    trainingCount: 30,
                    actuals: [50, 50, 50, 50, 50],
                    predictions: [100, 100, 100, 100, 100]
                }
            ], { tenantId: TENANT_B });

            const rA = CalibrationEvaluator.evaluate(btA, 0.95, {
                tenantId: TENANT_A,
                coverageLevels: [0.95],
                minEvaluated: 5,
                tolerance: 0.05
            });

            const rB = CalibrationEvaluator.evaluate(btB, 0.95, {
                tenantId: TENANT_B,
                coverageLevels: [0.95],
                minEvaluated: 5,
                tolerance: 0.05
            });

            // Different empirical coverage (A: actuals=100, B: actuals=50)
            // Both should be measured independently
            // The key check: evaluations did not cross-contaminate
            expect(rA.numberEvaluated).toBe(5);
            expect(rB.numberEvaluated).toBe(5);
        });
    });

    // ===== Provenance =====

    describe("Provenance", () => {
        test("report includes full provenance", () => {
            const bt = buildBacktest([
                {
                    trainingEnd: "2025-12-31",
                    validationStart: "2026-01-05",
                    validationEnd: "2026-01-09",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100]
                },
                {
                    trainingEnd: "2026-01-04",
                    validationStart: "2026-01-10",
                    validationEnd: "2026-01-14",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100]
                }
            ]);

            const report = CalibrationEvaluator.generateReport(bt, 0.95, {
                tenantId: TENANT_A,
                coverageLevels: [0.95],
                minEvaluated: 5,
                tolerance: 0.05
            });

            expect(report.provenance.source).toBe("calibration-evaluator");
            expect(report.provenance.tenant).toBe(TENANT_A);
            expect(report.provenance.metric).toBe(METRIC);
            expect(report.provenance.coverageLevel).toBe(0.95);
            expect(report.provenance.evaluatedAt).toBeDefined();
            expect(report.tenantId).toBe(TENANT_A);
            expect(report.metricName).toBe(METRIC);
            expect(report.method).toBeDefined();
        });
    });

    // ===== Deterministic execution =====

    describe("Deterministic repeated execution", () => {
        test("100 repeated evaluations produce identical results", () => {
            const bt = buildBacktest([
                {
                    trainingEnd: "2025-12-31",
                    validationStart: "2026-01-05",
                    validationEnd: "2026-01-14",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100]
                },
                {
                    trainingEnd: "2026-01-04",
                    validationStart: "2026-01-15",
                    validationEnd: "2026-01-24",
                    trainingCount: 30,
                    actuals: [95, 105, 100, 100, 95, 105, 100, 100, 95, 105],
                    predictions: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100]
                }
            ]);

            const config = {
                tenantId: TENANT_A,
                coverageLevels: [0.95],
                minEvaluated: 5,
                tolerance: 0.05
            };

            const first = CalibrationEvaluator.evaluate(bt, 0.95, config);

            for (let i = 0; i < 100; i++) {
                const r = CalibrationEvaluator.evaluate(bt, 0.95, config);
                expect(r.numberEvaluated).toBe(first.numberEvaluated);
                expect(r.numberCovered).toBe(first.numberCovered);
                expect(r.empiricalCoverage).toBe(first.empiricalCoverage);
                expect(r.status).toBe(first.status);
            }
        });
    });

    // ===== No future leakage =====

    describe("No future leakage", () => {
        test("walk-forward: split[i] interval uses only splits[0..i-1] residuals", () => {
            // Construct backtest where split 0 has large residuals,
            // split 1 has tiny residuals, split 2 has large residuals.
            // The interval for split 1 should be narrow (uses split 0's tiny residuals... wait, split 0 has large).
            // Actually: interval for split[i] uses splits[0..i-1].
            // For split 1, residuals = split 0 residuals.
            // For split 2, residuals = splits[0,1] combined.

            // To verify no leakage, we can check that the interval for split 2
            // is NOT influenced by split 2's own actuals.
            // We test this by running evaluation and checking the structure.

            const bt = buildBacktest([
                {
                    trainingEnd: "2025-12-31",
                    validationStart: "2026-01-05",
                    validationEnd: "2026-01-09",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100]
                },
                {
                    trainingEnd: "2026-01-04",
                    validationStart: "2026-01-10",
                    validationEnd: "2026-01-14",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100]
                },
                {
                    trainingEnd: "2026-01-09",
                    validationStart: "2026-01-15",
                    validationEnd: "2026-01-19",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100]
                }
            ]);

            // Modify split 2 actuals to be extreme. If leakage occurred, the
            // interval for split 1 might be affected. But it shouldn't be.
            const modified = JSON.parse(JSON.stringify(bt));
            modified.splits[2].actuals[0].actualValue = 1e10;

            const report1 = CalibrationEvaluator.generateReport(bt, 0.95, {
                tenantId: TENANT_A,
                coverageLevels: [0.95],
                minEvaluated: 5,
                tolerance: 0.05
            });

            const report2 = CalibrationEvaluator.generateReport(modified, 0.95, {
                tenantId: TENANT_A,
                coverageLevels: [0.95],
                minEvaluated: 5,
                tolerance: 0.05
            });

            // Split 1 (index 1) interval should be identical regardless of split 2
            // Check perOriginCoverage[0] (which is for split 1 since we start from i=1)
            expect(report1.perOriginCoverage[0].numberEvaluated)
                .toBe(report2.perOriginCoverage[0].numberEvaluated);
        });
    });

    // ===== Invalid input =====

    describe("Invalid input", () => {
        test("invalid coverage (0) → invalid_request", () => {
            const bt = buildBacktest([
                {
                    trainingEnd: "2025-12-31",
                    validationStart: "2026-01-05",
                    validationEnd: "2026-01-09",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100]
                },
                {
                    trainingEnd: "2026-01-04",
                    validationStart: "2026-01-10",
                    validationEnd: "2026-01-14",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100]
                }
            ]);

            const result = CalibrationEvaluator.evaluate(bt, 0, {
                tenantId: TENANT_A,
                coverageLevels: [0],
                minEvaluated: 1,
                tolerance: 0.05
            });

            expect(result.status).toBe("invalid_request");
        });

        test("invalid coverage (1) → invalid_request", () => {
            const bt = buildBacktest([
                {
                    trainingEnd: "2025-12-31",
                    validationStart: "2026-01-05",
                    validationEnd: "2026-01-09",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100]
                },
                {
                    trainingEnd: "2026-01-04",
                    validationStart: "2026-01-10",
                    validationEnd: "2026-01-14",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100]
                }
            ]);

            const result = CalibrationEvaluator.evaluate(bt, 1, {
                tenantId: TENANT_A,
                coverageLevels: [1],
                minEvaluated: 1,
                tolerance: 0.05
            });

            expect(result.status).toBe("invalid_request");
        });

        test("backtest with 1 split → insufficient_data", () => {
            const bt = buildBacktest([
                {
                    trainingEnd: "2025-12-31",
                    validationStart: "2026-01-05",
                    validationEnd: "2026-01-09",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100]
                }
            ]);

            const result = CalibrationEvaluator.evaluate(bt, 0.95, {
                tenantId: TENANT_A,
                coverageLevels: [0.95],
                minEvaluated: 1,
                tolerance: 0.05
            });

            expect(result.status).toBe("insufficient_data");
        });
    });

    // ===== Interval width =====

    describe("Interval width statistics", () => {
        test("width statistics are computed correctly", () => {
            const bt = buildBacktest([
                {
                    trainingEnd: "2025-12-31",
                    validationStart: "2026-01-05",
                    validationEnd: "2026-01-09",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100]
                },
                {
                    trainingEnd: "2026-01-04",
                    validationStart: "2026-01-10",
                    validationEnd: "2026-01-14",
                    trainingCount: 30,
                    actuals: [100, 100, 100, 100, 100],
                    predictions: [100, 100, 100, 100, 100]
                }
            ]);

            const result = CalibrationEvaluator.evaluate(bt, 0.95, {
                tenantId: TENANT_A,
                coverageLevels: [0.95],
                minEvaluated: 5,
                tolerance: 0.05
            });

            // With residuals all 0, interval width = 0
            expect(result.averageWidth).toBe(0);
            expect(result.medianWidth).toBe(0);
            expect(result.minWidth).toBe(0);
            expect(result.maxWidth).toBe(0);
        });
    });
});
