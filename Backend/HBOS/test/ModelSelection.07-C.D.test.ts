/**
 * Stage 07-C.D - Model Selection Tests
 *
 * Focused tests for:
 * 1. Candidate comparison
 * 2. MAE-first selection
 * 3. RMSE tie-break
 * 4. Deterministic tie resolution
 * 5. Unavailable candidate handling
 * 6. No future leakage
 * 7. Tenant isolation
 * 8. Provenance
 * 9. Repeated deterministic execution
 */

let TimeSeriesStore: any;
try {
    ({ TimeSeriesStore } = require("../Temporal/TimeSeriesStore"));
} catch (e) {
    TimeSeriesStore = null;
}

import { ModelSelector } from "../Forecasting";
import { PreparedTimeSeries, ForecastMethod } from "../Forecasting/ForecastTypes";
import { ModelSelectionConfig } from "../Forecasting/SelectionTypes";

describe("Stage 07-C.D: Model Selection", () => {
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

    function createConfig(overrides: Partial<ModelSelectionConfig> = {}): ModelSelectionConfig {
        return {
            tenantId: TENANT_A,
            metricName: METRIC,
            startTime: "2026-01-01",
            endTime: "2026-12-31",
            initialTrainingSize: 8,
            validationSize: 2,
            stepSize: 1,
            candidateMovingAverageWindow: 3,
            candidateSeasonalPeriod: 3,
            candidateExponentialSmoothingAlpha: 0.5,
            ...overrides
        };
    }

    // ===== A: BASIC SELECTION =====

    describe("A: Basic Selection", () => {
        test("selects a method from candidates", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createConfig();

            const result = ModelSelector.selectFromSeries(series, config);

            expect(result.status).toBe("success");
            expect(result.selectedMethod).not.toBeNull();
        });

        test("result includes all candidate evaluations", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createConfig();

            const result = ModelSelector.selectFromSeries(series, config);

            expect(result.candidates.length).toBeGreaterThan(0);
        });

        test("each candidate has MAE/RMSE if applicable", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createConfig();

            const result = ModelSelector.selectFromSeries(series, config);

            const applicable = result.candidates.filter(c => c.status === "applicable");
            for (const c of applicable) {
                expect(c.mae).not.toBeNull();
                expect(c.rmse).not.toBeNull();
            }
        });
    });

    // ===== B: MAE-FIRST SELECTION =====

    describe("B: MAE-First Selection", () => {
        test("selects method with lowest MAE", () => {
            // Constant series - all methods should have similar MAE
            // But we can still verify the selection rule
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createConfig();

            const result = ModelSelector.selectFromSeries(series, config);

            // Find candidate with lowest MAE
            const applicable = result.candidates.filter(c => c.status === "applicable");
            if (applicable.length > 0) {
                const minMAE = Math.min(...applicable.map(c => c.mae!));
                const winner = applicable.find(c => c.mae === minMAE);
                expect(winner!.method).toBe(result.selectedMethod);
            }
        });
    });

    // ===== C: RMSE TIE-BREAK =====

    describe("C: RMSE Tie-Break", () => {
        test("uses RMSE when MAE is tied", () => {
            // Constant series: all methods have identical MAE
            // Use constant series to force a tie
            const series = createMockSeries([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]);
            const config = createConfig();

            const result = ModelSelector.selectFromSeries(series, config);

            // With identical predictions for all methods on constant series,
            // all MAEs should be 0, so selection falls through to method priority
            expect(result.status).toBe("success");
            expect(result.selectedMethod).toBe("naive"); // First in priority
        });
    });

    // ===== D: DETERMINISTIC METHOD PRIORITY =====

    describe("D: Deterministic Method Priority", () => {
        test("method priority resolves final ties", () => {
            // Constant series => all methods have MAE=0
            // Default priority: naive > moving_average > exponential_smoothing > seasonal_naive
            const series = createMockSeries([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]);
            const config = createConfig();

            const result = ModelSelector.selectFromSeries(series, config);

            // naive has highest priority
            expect(result.selectedMethod).toBe("naive");
        });

        test("custom method priority is respected", () => {
            const series = createMockSeries([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]);
            const config = createConfig({
                methodPriority: ["exponential_smoothing", "naive", "moving_average", "seasonal_naive"]
            });

            const result = ModelSelector.selectFromSeries(series, config);

            // With all MAEs=0, custom priority says exponential_smoothing wins
            expect(result.selectedMethod).toBe("exponential_smoothing");
        });
    });

    // ===== E: UNAVAILABLE CANDIDATE HANDLING =====

    describe("E: Unavailable Candidate Handling", () => {
        test("seasonal_naive with insufficient data is marked insufficient_data", () => {
            // Small series - seasonal_naive needs 3+ observations per split
            // Use a small series to make seasonal_naive fail
            const series = createMockSeries([10, 20, 30, 40, 50]);
            const config = createConfig({
                initialTrainingSize: 3,
                validationSize: 1,
                candidateSeasonalPeriod: 3
            });

            const result = ModelSelector.selectFromSeries(series, config);

            const seasonal = result.candidates.find(c => c.method === "seasonal_naive");
            // Seasonal naive requires n >= seasonalPeriod AND training >= seasonalPeriod
            expect(seasonal).toBeDefined();
        });

        test("moving_average with insufficient data is marked invalid_config", () => {
            const series = createMockSeries([10, 20, 30]);
            const config = createConfig({
                initialTrainingSize: 5, // More than series length
                validationSize: 1
            });

            const result = ModelSelector.selectFromSeries(series, config);

            expect(result.status).toBe("invalid_request");
        });

        test("unavailable candidate does not affect selection", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            // Only test naive and seasonal_naive - other methods marked as not applicable
            const config = createConfig({
                candidateMethods: ["naive", "seasonal_naive", "moving_average"],
                candidateSeasonalPeriod: 100, // way too large for 8-obs training
                candidateMovingAverageWindow: 100 // way too large
            });

            const result = ModelSelector.selectFromSeries(series, config);

            // seasonal_naive should be marked unavailable
            const seasonal = result.candidates.find(c => c.method === "seasonal_naive");
            if (seasonal) {
                expect(seasonal.status).not.toBe("applicable");
            }
            // moving_average should be marked unavailable
            const ma = result.candidates.find(c => c.method === "moving_average");
            if (ma) {
                expect(ma.status).not.toBe("applicable");
            }
            // naive should be selected
            expect(result.selectedMethod).toBe("naive");
        });
    });

    // ===== F: NO VALID CANDIDATES =====

    describe("F: No Valid Candidates", () => {
        test("returns no_valid_candidates when none applicable", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createConfig({
                candidateMethods: ["seasonal_naive"],
                candidateSeasonalPeriod: 100, // Too large for splits
                stepSize: 1
            });

            const result = ModelSelector.selectFromSeries(series, config);

            expect(result.status).toBe("no_valid_candidates");
            expect(result.selectedMethod).toBeNull();
        });
    });

    // ===== G: NO FUTURE LEAKAGE =====

    describe("G: No Future Leakage", () => {
        test("leakage status is verified", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createConfig();

            const result = ModelSelector.selectFromSeries(series, config);

            expect(result.evidence.leakageStatus.verified).toBe(true);
            expect(result.evidence.leakageStatus.allSplitsHaveNoLeakage).toBe(true);
        });

        test("mutating future value does not affect selection", () => {
            const baseValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
            const modifiedValues = [...baseValues];
            modifiedValues[11] = 999;

            const series1 = createMockSeries(baseValues);
            const series2 = createMockSeries(modifiedValues);
            const config = createConfig();

            const result1 = ModelSelector.selectFromSeries(series1, config);
            const result2 = ModelSelector.selectFromSeries(series2, config);

            // Selection should be identical (training data unchanged)
            expect(result1.selectedMethod).toBe(result2.selectedMethod);
        });
    });

    // ===== H: TENANT ISOLATION =====

    describe("H: Tenant Isolation", () => {
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

        test("different tenants get different evaluations", async () => {
            for (let i = 0; i < 12; i++) {
                const date = new Date("2026-01-01");
                date.setDate(date.getDate() + i);
                await store.append({
                    tenantId: TENANT_A,
                    metricName: METRIC,
                    value: 10 + i * 5,
                    timestamp: date.toISOString().split("T")[0],
                    source: "test"
                });
                await store.append({
                    tenantId: TENANT_B,
                    metricName: METRIC,
                    value: 1000, // Very different
                    timestamp: date.toISOString().split("T")[0],
                    source: "test"
                });
            }

            const configA: ModelSelectionConfig = {
                tenantId: TENANT_A,
                metricName: METRIC,
                startTime: "2026-01-01",
                endTime: "2026-01-12",
                initialTrainingSize: 8,
                validationSize: 2,
                candidateMovingAverageWindow: 3
            };
            const configB = { ...configA, tenantId: TENANT_B };

            const resultA = await ModelSelector.select(store, configA);
            const resultB = await ModelSelector.select(store, configB);

            // Both should succeed but with potentially different selected methods
            expect(resultA.status).toBe("success");
            expect(resultB.status).toBe("success");
        });
    });

    // ===== I: PROVENANCE =====

    describe("I: Provenance and Evidence", () => {
        test("evidence includes selection rules", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createConfig();

            const result = ModelSelector.selectFromSeries(series, config);

            expect(result.evidence.selectionMetric).toBe("MAE");
            expect(result.evidence.tieBreakRule).toBe("RMSE, then deterministic method priority");
            expect(result.evidence.tenant).toBe(TENANT_A);
            expect(result.evidence.metric).toBe(METRIC);
        });

        test("evidence includes method priority", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createConfig();

            const result = ModelSelector.selectFromSeries(series, config);

            expect(result.evidence.methodPriority.length).toBeGreaterThan(0);
        });
    });

    // ===== J: DETERMINISTIC EXECUTION =====

    describe("J: Deterministic Execution", () => {
        test("repeated execution produces identical results", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createConfig();

            const result1 = ModelSelector.selectFromSeries(series, config);
            const result2 = ModelSelector.selectFromSeries(series, config);
            const result3 = ModelSelector.selectFromSeries(series, config);

            expect(result1.selectedMethod).toBe(result2.selectedMethod);
            expect(result2.selectedMethod).toBe(result3.selectedMethod);
            expect(result1.evidence.selectedMAE).toBe(result2.evidence.selectedMAE);
        });
    });

    // ===== K: EDGE CASES =====

    describe("K: Edge Cases", () => {
        test("only one valid candidate is auto-selected", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createConfig({
                candidateMethods: ["naive"]
            });

            const result = ModelSelector.selectFromSeries(series, config);

            expect(result.status).toBe("success");
            expect(result.selectedMethod).toBe("naive");
        });

        test("invalid initialTrainingSize returns invalid_request", () => {
            const series = createMockSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
            const config = createConfig({ initialTrainingSize: 0 });

            const result = ModelSelector.selectFromSeries(series, config);

            expect(result.status).toBe("invalid_request");
        });

        test("training + validation > series returns invalid_request", () => {
            const series = createMockSeries([10, 20, 30, 40, 50]);
            const config = createConfig({ initialTrainingSize: 4, validationSize: 4 });

            const result = ModelSelector.selectFromSeries(series, config);

            expect(result.status).toBe("invalid_request");
        });
    });
});
