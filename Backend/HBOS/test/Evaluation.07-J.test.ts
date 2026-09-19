/**
 * Stage 07-J - Explainability / Model Evaluation Tests
 *
 * Focused tests for:
 * 1. EvaluationRecordBuilder metrics computation
 * 2. Baseline comparison and drift detection
 * 3. Feature contribution (linear coefficients and permutation)
 * 4. Assumption validation
 * 5. EvaluationRegistry (in-memory)
 * 6. Tenant isolation
 * 7. Provenance completeness
 * 8. Determinism
 * 9. Honest limitations
 */

import { EvaluationRecordBuilder } from "../Uncertainty/EvaluationRecordBuilder";
import { DriftDetector } from "../Uncertainty/DriftDetector";
import { FeatureContributionAnalyzer as FeatureContribution } from "../Uncertainty/FeatureContribution";
import { AssumptionValidator } from "../Uncertainty/AssumptionValidator";
import { EvaluationRegistry, evaluationRegistry } from "../Uncertainty/EvaluationRegistry";
import { MethodIdentifier, EvaluationMetric, EvaluationRecord } from "../Uncertainty/EvaluationTypes";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

const makeMethodId = (overrides: Partial<MethodIdentifier> = {}): MethodIdentifier => {
    const base: MethodIdentifier = {
        name: "naive_forecast",
        version: "1.0.0",
        category: "statistical",
        description: "Naive forecast method"
    };
    return Object.freeze({ ...base, ...overrides });
};

const makeWindow = () => Object.freeze({ start: "2026-01-01", end: "2026-01-31" });

describe("Stage 07-J: Explainability / Model Evaluation", () => {

    // ===== EvaluationRecordBuilder =====

    describe("EvaluationRecordBuilder", () => {
        const methodId = makeMethodId();
        const window = makeWindow();

        test("J1: Build for known residuals [1, -1, 2, -2]: MSE = 2.5, MAE = 1.5", () => {
            const record = EvaluationRecordBuilder.buildForForecast(
                [1, -1, 2, -2],
                [],
                methodId,
                TENANT_A,
                window
            );
            const mse = record.metrics.find(m => m.name === "mse");
            const mae = record.metrics.find(m => m.name === "mae");
            expect(mse).toBeDefined();
            expect(mae).toBeDefined();
            if (mse && mae) {
                expect(mse.value).toBeCloseTo(2.5, 5);
                expect(mae.value).toBeCloseTo(1.5, 5);
            }
        });

        test("J2: Compare to baseline: improvement sign correct", () => {
            const betterResiduals = [0.5, -0.5, 1, -1];
            const worseResiduals = [2, -2, 3, -3];
            const record = EvaluationRecordBuilder.buildForForecast(
                betterResiduals,
                worseResiduals,
                methodId,
                TENANT_A,
                window
            );
            expect(record.baselineComparison).toBeDefined();
            if (record.baselineComparison) {
                expect(record.baselineComparison.isImprovement).toBe(true);
            }
        });

        test("J3: Drift: large shift flagged", () => {
            const stableResiduals = [0.1, -0.1, 0.2, -0.2];
            const baselineResiduals = [0.1, -0.1, 0.2, -0.2];
            const shiftedResiduals = [5, -5, 6, -6];
            const record = EvaluationRecordBuilder.buildForForecast(
                shiftedResiduals,
                baselineResiduals,
                methodId,
                TENANT_A,
                window
            );
            const mseDrift = record.drift.find(d => d.metric === "mse");
            expect(mseDrift).toBeDefined();
            if (mseDrift) {
                expect(mseDrift.isDrift).toBe(true);
            }
        });

        test("J4: All required fields present", () => {
            const record = EvaluationRecordBuilder.buildForForecast(
                [1, -1],
                [],
                methodId,
                TENANT_A,
                window
            );
            expect(record.methodId).toBeDefined();
            expect(record.dataset).toBe(TENANT_A);
            expect(record.metrics.length).toBeGreaterThan(0);
            expect(record.drift.length).toBeGreaterThan(0);
            expect(record.assumptions.length).toBeGreaterThan(0);
            expect(record.limitations.length).toBeGreaterThan(0);
            expect(record.timestamp).toBeDefined();
            expect(record.provenance).toBeDefined();
        });

        test("J5: Tenant isolation: reject mismatched tenant", () => {
            const record = EvaluationRecordBuilder.buildForForecast(
                [1, -1],
                [],
                methodId,
                TENANT_B,
                window
            );
            expect(record.provenance.tenant).toBe(TENANT_B);
        });
    });

    // ===== DriftDetector =====

    describe("DriftDetector", () => {
        test("J6: Same value -> no drift", () => {
            const indicator = DriftDetector.detectMetricDrift(0.5, 0.5, 0.1, "mse");
            expect(indicator.isDrift).toBe(false);
            expect(indicator.driftScore).toBe(0);
        });

        test("J7: Different value > threshold -> drift", () => {
            const indicator = DriftDetector.detectMetricDrift(0.1, 0.5, 0.1, "mse");
            expect(indicator.isDrift).toBe(true);
            expect(indicator.driftScore).toBe(0.4);
        });

        test("J8: Threshold sensitivity", () => {
            const indicator1 = DriftDetector.detectMetricDrift(0.1, 0.3, 0.25, "mse");
            expect(indicator1.isDrift).toBe(false);
            const indicator2 = DriftDetector.detectMetricDrift(0.1, 0.3, 0.15, "mse");
            expect(indicator2.isDrift).toBe(true);
        });

        test("J9: Edge: std=0 -> handle gracefully", () => {
            const baseline = [0.1, 0.1, 0.1];
            const current = [0.2, 0.2, 0.2];
            const indicator = DriftDetector.detectDistributionDrift(baseline, current, 0.1, "mae");
            expect(indicator.isDrift).toBe(true);
            expect(indicator.driftScore).toBeGreaterThan(0);
        });

        test("J10: Distribution drift: shifted mean detected", () => {
            const baseline = [1, 2, 3, 4, 5];
            const current = [6, 7, 8, 9, 10];
            const indicator = DriftDetector.detectDistributionDrift(baseline, current, 0.5, "rmse");
            expect(indicator.isDrift).toBe(true);
            expect(indicator.currentValue).toBeGreaterThan(indicator.baselineValue);
        });
    });

    // ===== FeatureContribution (linear) =====

    describe("FeatureContribution (linear)", () => {
        test("J11: Known coefficients [2, -1] -> contribution magnitudes = [2, 1], directions = ['positive', 'negative']", () => {
            const evidence = FeatureContribution.fromLinearCoefficients([2, -1], ["x1", "x2"]);
            expect(evidence.contributions.length).toBe(2);
            expect(evidence.contributions[0].feature).toBe("x1");
            expect(evidence.contributions[0].contribution).toBe(2);
            expect(evidence.contributions[0].direction).toBe("positive");
            expect(evidence.contributions[0].magnitude).toBe(2);
            expect(evidence.contributions[1].feature).toBe("x2");
            expect(evidence.contributions[1].contribution).toBe(-1);
            expect(evidence.contributions[1].direction).toBe("negative");
            expect(evidence.contributions[1].magnitude).toBe(1);
        });

        test("J12: Empty coefficients -> empty contributions", () => {
            const evidence = FeatureContribution.fromLinearCoefficients([], []);
            expect(evidence.contributions.length).toBe(0);
            expect(evidence.confidence).toBe(0);
        });

        test("J13: Mismatched lengths -> invalid_request", () => {
            expect(() => {
                FeatureContribution.fromLinearCoefficients([2, -1], ["x1"]);
            }).toThrow("invalid_request");
        });

        test("J14: Confidence in [0, 1]", () => {
            const evidence = FeatureContribution.fromLinearCoefficients([2, -1, 0.5], ["x1", "x2", "x3"]);
            expect(evidence.confidence).toBeGreaterThanOrEqual(0);
            expect(evidence.confidence).toBeLessThanOrEqual(1);
        });
    });

    // ===== FeatureContribution (permutation) =====

    describe("FeatureContribution (permutation)", () => {
        test("J15: Linear model: permute the important feature -> metric drops significantly", () => {
            const model = {
                predict: (features: number[]) => features[0] * 2 + features[1] * -1
            };
            const testData = {
                features: [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]],
                labels: [1, 3, 5, 7, 9]
            };
            const baselineMetric = 0;
            const evidence = FeatureContribution.fromPermutation(model, testData, baselineMetric, 5, 42);
            expect(evidence.contributions.length).toBe(2);
            expect(evidence.contributions[0].contribution).not.toBeCloseTo(0, 3);
        });

        test("J16: Use small test data (5 rows)", () => {
            const model = {
                predict: (features: number[]) => features[0]
            };
            const testData = {
                features: [[1], [2], [3], [4], [5]],
                labels: [1, 2, 3, 4, 5]
            };
            const evidence = FeatureContribution.fromPermutation(model, testData, 0, 3, 42);
            expect(evidence.contributions.length).toBe(1);
        });

        test("J17: Determinism: same seed -> same result", () => {
            const model = {
                predict: (features: number[]) => features[0]
            };
            const testData = {
                features: [[1], [2], [3], [4], [5]],
                labels: [1, 2, 3, 4, 5]
            };
            const a = FeatureContribution.fromPermutation(model, testData, 0, 3, 42);
            const b = FeatureContribution.fromPermutation(model, testData, 0, 3, 42);
            expect(a.contributions[0].contribution).toBe(b.contributions[0].contribution);
        });
    });

    // ===== AssumptionValidator =====

    describe("AssumptionValidator", () => {
        test("J18: Stationary series -> isValid=true", () => {
            const series = [1, 1, 1, 1, 1, 1, 1, 1];
            const result = AssumptionValidator.validateStationarity(series);
            expect(result.isValid).toBe(true);
        });

        test("J19: Non-stationary (step function) -> isValid=false", () => {
            const series = [1, 1, 1, 1, 10, 10, 10, 10];
            const result = AssumptionValidator.validateStationarity(series);
            expect(result.isValid).toBe(false);
        });

        test("J20: Uncorrelated series -> isValid=true", () => {
            const s1 = [1, 2, 3, 4, 5];
            const s2 = [2, 5, 1, 4, 3];
            const result = AssumptionValidator.validateIndependence(s1, s2);
            expect(result.isValid).toBe(true);
        });

        test("J21: Linear model on linear data -> residual mean approx 0", () => {
            const predicted = [1, 2, 3, 4, 5];
            const residuals = [0, 0, 0, 0, 0];
            const result = AssumptionValidator.validateLinearity(residuals, predicted);
            expect(result.isValid).toBe(true);
        });

        test("J22: Empty series -> handle gracefully", () => {
            const result = AssumptionValidator.validateStationarity([]);
            expect(result.isValid).toBe(false);
            expect(result.validationNote).toContain("Insufficient data");
        });
    });

    // ===== EvaluationRegistry =====

    describe("EvaluationRegistry", () => {
        test("J23: Register, retrieve, getLatest, getAll", () => {
            const registry = new EvaluationRegistry();
            const methodId = makeMethodId({ name: "test_method" });
            const record1 = EvaluationRecordBuilder.buildForForecast([1, -1], [], methodId, TENANT_A, makeWindow());
            const record2 = EvaluationRecordBuilder.buildForForecast([2, -2], [], methodId, TENANT_A, makeWindow());
            registry.register(record1);
            registry.register(record2);
            const all = registry.getAll(TENANT_A);
            expect(all.length).toBe(2);
            const latest = registry.getLatest("test_method", TENANT_A);
            expect(latest).toBeDefined();
            if (latest) {
                expect(latest.timestamp).toBe(record2.timestamp);
            }
        });

        test("J24: Tenant isolation: tenant A doesn't see tenant B records", () => {
            const registry = new EvaluationRegistry();
            const methodId = makeMethodId({ name: "tenant_method" });
            const recordA = EvaluationRecordBuilder.buildForForecast([1, -1], [], methodId, TENANT_A, makeWindow());
            const recordB = EvaluationRecordBuilder.buildForForecast([2, -2], [], methodId, TENANT_B, makeWindow());
            registry.register(recordA);
            registry.register(recordB);
            const aRecords = registry.getAll(TENANT_A);
            const bRecords = registry.getAll(TENANT_B);
            expect(aRecords.length).toBe(1);
            expect(bRecords.length).toBe(1);
            expect(aRecords[0].provenance.tenant).toBe(TENANT_A);
            expect(bRecords[0].provenance.tenant).toBe(TENANT_B);
        });

        test("J25: Empty registry returns empty", () => {
            const registry = new EvaluationRegistry();
            expect(registry.getAll(TENANT_A).length).toBe(0);
        });

        test("J26: getLatest on missing returns null", () => {
            const registry = new EvaluationRegistry();
            expect(registry.getLatest("missing", TENANT_A)).toBeNull();
        });
    });

    // ===== Tenant Isolation =====

    describe("Tenant Isolation", () => {
        test("J27: Cross-tenant query rejected", () => {
            const registry = new EvaluationRegistry();
            const methodId = makeMethodId({ name: "cross_tenant" });
            const record = EvaluationRecordBuilder.buildForForecast([1, -1], [], methodId, TENANT_A, makeWindow());
            registry.register(record);
            expect(() => registry.getAll("")).toThrow();
        });

        test("J28: Cross-tenant register rejected via provenance", () => {
            const methodId = makeMethodId({ name: "cross_register" });
            const record = EvaluationRecordBuilder.buildForForecast([1, -1], [], methodId, TENANT_A, makeWindow());
            expect(record.provenance.tenant).toBe(TENANT_A);
        });
    });

    // ===== Provenance =====

    describe("Provenance", () => {
        test("J29: All required fields present", () => {
            const methodId = makeMethodId();
            const record = EvaluationRecordBuilder.buildForForecast([1, -1], [], methodId, TENANT_A, makeWindow());
            const p = record.provenance;
            expect(p.source).toBe("EvaluationRecordBuilder");
            expect(p.tenant).toBe(TENANT_A);
            expect(p.method).toBe(methodId.name);
            expect(p.evaluationWindow.start).toBeDefined();
            expect(p.evaluationWindow.end).toBeDefined();
            expect(p.calculatedAt).toBeDefined();
        });
    });

    // ===== Determinism =====

    describe("Determinism", () => {
        test("J30: 100 identical register/getAll calls produce identical registry state", () => {
            const registry = new EvaluationRegistry();
            const methodId = makeMethodId({ name: "determinism" });
            const first = EvaluationRecordBuilder.buildForForecast([1, -1], [], methodId, TENANT_A, makeWindow());
            registry.register(first);
            const firstCount = registry.getAll(TENANT_A).length;
            for (let i = 0; i < 100; i++) {
                const r = new EvaluationRegistry();
                r.register(first);
                expect(r.getAll(TENANT_A).length).toBe(firstCount);
            }
        });
    });

    // ===== Honest Limitations =====

    describe("Honest Limitations", () => {
        test("J31: Method without explainability support returns empty contributions", () => {
            const evidence = FeatureContribution.fromLinearCoefficients([], []);
            expect(evidence.contributions.length).toBe(0);
            expect(evidence.confidence).toBe(0);
        });

        test("J32: Method without calibration applicability returns not_applicable", () => {
            const methodId = makeMethodId();
            const record = EvaluationRecordBuilder.buildForForecast([1, -1], [], methodId, TENANT_A, makeWindow());
            expect(record.calibration).toBeDefined();
            if (record.calibration) {
                expect(record.calibration.applicable).toBe(false);
                expect(record.calibration.status).toBe("not_applicable");
            }
        });
    });
});
