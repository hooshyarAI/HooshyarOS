/**
 * Stage 07-F - ML / Ensemble / Anomaly Tests
 *
 * Hand-verifiable, deterministic tests for:
 *  1. LinearRegressionModel OLS on known linear data
 *  2. LinearRegressionModel edge cases (constant, empty, single point, singular)
 *  3. AnomalyDetector MAD and Z-score detectors
 *  4. EnsembleAggregator mean/median/weighted
 *  5. TrainTestSplitter chronological split + unsorted rejection
 *  6. Tenant isolation, determinism, provenance
 */

import { LinearRegressionModel } from "../Uncertainty/LinearRegressionModel";
import { AnomalyDetector, DEFAULT_MAD_THRESHOLD, DEFAULT_ZSCORE_THRESHOLD } from "../Uncertainty/AnomalyDetector";
import { EnsembleAggregator } from "../Uncertainty/EnsembleAggregator";
import { TrainTestSplitter } from "../Uncertainty/TrainTestSplitter";
import { TrainingDataPoint, FeatureSpec } from "../Uncertainty/MLTypes";

function makeLinearData(n: number, slope: number = 2, intercept: number = 1,
    tenant: string = "tenant-a", metric: string = "revenue"): TrainingDataPoint[] {
    const out: TrainingDataPoint[] = [];
    for (let i = 0; i < n; i++) {
        const x = i;
        out.push({
            timestamp: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
            features: Object.freeze([x]),
            label: slope * x + intercept,
            tenantId: tenant,
            metricName: metric
        });
    }
    return out;
}

function makeConstantData(n: number, c: number = 7,
    tenant: string = "tenant-a", metric: string = "revenue"): TrainingDataPoint[] {
    const out: TrainingDataPoint[] = [];
    for (let i = 0; i < n; i++) {
        out.push({
            timestamp: `2026-02-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
            features: Object.freeze([i]),
            label: c,
            tenantId: tenant,
            metricName: metric
        });
    }
    return out;
}

function singleFeatureSpec(): FeatureSpec[] {
    return [Object.freeze({ name: "x", index: 0, isCategorical: false, encoding: "passthrough" as const })];
}

describe("LinearRegressionModel.train", () => {
    test("trains on y=2x+1 and recovers coefficients within tolerance", () => {
        const data = makeLinearData(20, 2, 1);
        const model = LinearRegressionModel.train(data, singleFeatureSpec(), "tenant-a", "revenue");
        expect(model.status).toBe("trained");
        expect(model.coefficients[0]).toBeCloseTo(1, 8);
        expect(model.coefficients[1]).toBeCloseTo(2, 8);
        expect(model.rSquared).toBeCloseTo(1, 8);
        expect(model.trainingSampleCount).toBe(20);
    });

    test("constant label yields RSS=0 and R^2 reported as 0 (no fabrication)", () => {
        const data = makeConstantData(10, 5);
        const model = LinearRegressionModel.train(data, singleFeatureSpec(), "tenant-a", "revenue");
        expect(model.status).toBe("trained");
        expect(model.rss).toBe(0);
        expect(model.rSquared).toBe(0);
    });

    test("predict on training data is essentially perfect for linear fit", () => {
        const data = makeLinearData(15, 3, 7);
        const model = LinearRegressionModel.train(data, singleFeatureSpec(), "tenant-a", "revenue");
        const pred = LinearRegressionModel.predict(model, [10]);
        expect(pred.value).toBeCloseTo(37, 8);
        expect(Math.abs(pred.standardError)).toBeLessThan(1e-6);
    });

    test("singular feature matrix returns not_converged", () => {
        const data: TrainingDataPoint[] = [];
        for (let i = 0; i < 6; i++) {
            data.push({
                timestamp: `2026-03-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
                features: Object.freeze([i, i]),
                label: i * 2,
                tenantId: "tenant-a",
                metricName: "revenue"
            });
        }
        const features: FeatureSpec[] = [
            Object.freeze({ name: "x1", index: 0, isCategorical: false, encoding: "passthrough" as const }),
            Object.freeze({ name: "x2", index: 1, isCategorical: false, encoding: "passthrough" as const })
        ];
        const model = LinearRegressionModel.train(data, features, "tenant-a", "revenue");
        expect(model.status).toBe("not_converged");
        expect(model.coefficients.length).toBe(0);
    });

    test("single point trivial case is insufficient_data", () => {
        const data = makeLinearData(1);
        const model = LinearRegressionModel.train(data, singleFeatureSpec(), "tenant-a", "revenue");
        expect(model.status).toBe("insufficient_data");
    });

    test("empty data is insufficient_data", () => {
        const model = LinearRegressionModel.train([], singleFeatureSpec(), "tenant-a", "revenue");
        expect(model.status).toBe("insufficient_data");
    });

    test("tenant mismatch in data rejects with tenant_isolation_violation", () => {
        const data: TrainingDataPoint[] = [
            { timestamp: "2026-01-01T00:00:00Z", features: Object.freeze([0]), label: 1, tenantId: "tenant-b", metricName: "revenue" },
            { timestamp: "2026-01-02T00:00:00Z", features: Object.freeze([1]), label: 3, tenantId: "tenant-a", metricName: "revenue" }
        ];
        const model = LinearRegressionModel.train(data, singleFeatureSpec(), "tenant-a", "revenue");
        expect(model.status).toBe("not_converged");
        expect(model.error).toMatch(/tenant_isolation_violation/);
    });

    test("predict on non-trained model returns NaN", () => {
        const data = makeLinearData(1);
        const model = LinearRegressionModel.train(data, singleFeatureSpec(), "tenant-a", "revenue");
        const pred = LinearRegressionModel.predict(model, [1]);
        expect(pred.value).toBeNaN();
        expect(pred.standardError).toBeNaN();
    });

    test("determinism: 100 identical train calls produce identical models", () => {
        const data = makeLinearData(10);
        const a = LinearRegressionModel.train(data, singleFeatureSpec(), "tenant-a", "revenue");
        let allSame = true;
        for (let i = 0; i < 100; i++) {
            const b = LinearRegressionModel.train(data, singleFeatureSpec(), "tenant-a", "revenue");
            if (JSON.stringify(b.coefficients) !== JSON.stringify(a.coefficients) ||
                b.rSquared !== a.rSquared) {
                allSame = false;
                break;
            }
        }
        expect(allSame).toBe(true);
    });

    test("evaluate returns near-zero MSE on training data", () => {
        const data = makeLinearData(10, 2, 1);
        const model = LinearRegressionModel.train(data, singleFeatureSpec(), "tenant-a", "revenue");
        const metrics = LinearRegressionModel.evaluate(model, data);
        expect(metrics.sampleCount).toBe(10);
        expect(metrics.mse).toBeCloseTo(0, 8);
        expect(metrics.rSquared).toBeCloseTo(1, 8);
    });
});

describe("AnomalyDetector.detectAnomalies (MAD)", () => {
    test("flags a clear outlier [1,2,3,4,5,100]", () => {
        const scores = AnomalyDetector.detectAnomalies([1, 2, 3, 4, 5, 100]);
        expect(scores.length).toBe(6);
        expect(scores[5].isAnomaly).toBe(true);
        for (let i = 0; i < 5; i++) expect(scores[i].isAnomaly).toBe(false);
    });

    test("constant signal -> no anomalies (MAD=0 handled)", () => {
        const scores = AnomalyDetector.detectAnomalies([5, 5, 5, 5, 5, 5, 5, 5]);
        for (const s of scores) expect(s.isAnomaly).toBe(false);
        expect(scores.some(s => /constant_signal/.test(s.reason))).toBe(true);
    });

    test("empty input returns empty scores", () => {
        const scores = AnomalyDetector.detectAnomalies([]);
        expect(scores.length).toBe(0);
    });

    test("small sample (n<5) returns no anomalies with reason", () => {
        const scores = AnomalyDetector.detectAnomalies([1, 2, 1000, 3]);
        expect(scores.length).toBe(4);
        for (const s of scores) {
            expect(s.isAnomaly).toBe(false);
            expect(s.reason).toMatch(/insufficient_data/);
        }
    });

    test("lower threshold flags more anomalies", () => {
        const data = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25];
        const strict = AnomalyDetector.detectAnomalies(data, 5.0);
        const lax = AnomalyDetector.detectAnomalies(data, 1.0);
        const strictCount = strict.filter(s => s.isAnomaly).length;
        const laxCount = lax.filter(s => s.isAnomaly).length;
        expect(laxCount).toBeGreaterThanOrEqual(strictCount);
    });

    test("reason string contains the actual score and threshold", () => {
        const scores = AnomalyDetector.detectAnomalies([1, 2, 3, 4, 5, 100]);
        expect(scores[5].reason).toMatch(new RegExp(`threshold=${DEFAULT_MAD_THRESHOLD}`));
        expect(scores[5].reason).toMatch(/modified_z=/);
    });
});

describe("AnomalyDetector.detectZScoreAnomalies", () => {
    test("flags outlier in approximately-normal data", () => {
        const data = [10, 11, 10, 12, 11, 10, 11, 12, 10, 11, 50];
        const scores = AnomalyDetector.detectZScoreAnomalies(data, 3.0);
        expect(scores[10].isAnomaly).toBe(true);
        for (let i = 0; i < 10; i++) expect(scores[i].isAnomaly).toBe(false);
    });

    test("constant values yield no anomalies (std=0 handled)", () => {
        const data = [4, 4, 4, 4, 4, 4, 4];
        const scores = AnomalyDetector.detectZScoreAnomalies(data);
        for (const s of scores) expect(s.isAnomaly).toBe(false);
        expect(scores.some(s => /constant_signal/.test(s.reason))).toBe(true);
    });

    test("default threshold is 3.0", () => {
        expect(DEFAULT_ZSCORE_THRESHOLD).toBe(3.0);
    });
});

describe("EnsembleAggregator.aggregate", () => {
    test("mean of [10,20,30] = 20", () => {
        const out = EnsembleAggregator.aggregate(
            [{ source: "a", value: 10 }, { source: "b", value: 20 }, { source: "c", value: 30 }],
            { method: "mean", tenant: "tenant-a", metric: "revenue" }
        );
        expect(out.aggregated).toBe(20);
        expect(out.method).toBe("mean");
    });

    test("median of [1,2,3,4,100] = 3", () => {
        const out = EnsembleAggregator.aggregate(
            [{ source: "a", value: 1 }, { source: "b", value: 2 }, { source: "c", value: 3 },
             { source: "d", value: 4 }, { source: "e", value: 100 }],
            { method: "median", tenant: "tenant-a", metric: "revenue" }
        );
        expect(out.aggregated).toBe(3);
    });

    test("weighted [0.5,0.5] of [10,20] = 15", () => {
        const out = EnsembleAggregator.aggregate(
            [{ source: "a", value: 10, weight: 0.5 }, { source: "b", value: 20, weight: 0.5 }],
            { method: "weighted", tenant: "tenant-a", metric: "revenue" }
        );
        expect(out.aggregated).toBe(15);
    });

    test("weighted [0.6,0.4] of [10,20] = 14", () => {
        const out = EnsembleAggregator.aggregate(
            [{ source: "a", value: 10, weight: 0.6 }, { source: "b", value: 20, weight: 0.4 }],
            { method: "weighted", tenant: "tenant-a", metric: "revenue" }
        );
        expect(out.aggregated).toBe(14);
    });

    test("weights are normalized to sum=1 even when raw weights do not", () => {
        const out = EnsembleAggregator.aggregate(
            [{ source: "a", value: 10, weight: 3 }, { source: "b", value: 20, weight: 1 }],
            { method: "weighted", tenant: "tenant-a", metric: "revenue" }
        );
        const sumW = out.weights.reduce((s: number, w: number) => s + w, 0);
        expect(sumW).toBeCloseTo(1, 10);
        expect(out.aggregated).toBe(12.5);
    });

    test("default equal weights when none provided", () => {
        const out = EnsembleAggregator.aggregate(
            [{ source: "a", value: 10 }, { source: "b", value: 20 }],
            { method: "weighted", tenant: "tenant-a", metric: "revenue" }
        );
        expect(out.aggregated).toBe(15);
    });

    test("determinism: 100 identical calls produce identical results", () => {
        const preds = [{ source: "a", value: 10 }, { source: "b", value: 20 }, { source: "c", value: 30 }];
        const opts = { method: "mean" as const, tenant: "tenant-a", metric: "revenue" };
        const a = EnsembleAggregator.aggregate(preds, opts);
        let same = true;
        for (let i = 0; i < 100; i++) {
            const b = EnsembleAggregator.aggregate(preds, opts);
            if (b.aggregated !== a.aggregated) { same = false; break; }
        }
        expect(same).toBe(true);
    });

    test("evaluateEnsemble returns expected metrics for a constant predictor", () => {
        const ens = EnsembleAggregator.aggregate(
            [{ source: "a", value: 10 }],
            { method: "mean", tenant: "tenant-a", metric: "revenue" }
        );
        const metrics = EnsembleAggregator.evaluateEnsemble(ens, [10, 12, 8, 14, 6]);
        expect(metrics.sampleCount).toBe(5);
        expect(metrics.mse).toBe(8);
        expect(metrics.rmse).toBeCloseTo(Math.sqrt(8), 8);
    });
});

describe("TrainTestSplitter.splitChronological", () => {
    test("10 points, ratio=0.7 yields 7 train and 3 test", () => {
        const data = makeLinearData(10);
        const split = TrainTestSplitter.splitChronological(data, 0.7);
        expect(split.trainingCount).toBe(7);
        expect(split.testCount).toBe(3);
        expect(split.splitRatio).toBe(0.7);
        expect(split.noFutureLeakage).toBe(true);
    });

    test("preserves chronological order across split", () => {
        const data = makeLinearData(20);
        const split = TrainTestSplitter.splitChronological(data, 0.5);
        const lastTrain = new Date(split.trainingData[split.trainingData.length - 1].timestamp).getTime();
        const firstTest = new Date(split.testData[0].timestamp).getTime();
        expect(firstTest).toBeGreaterThanOrEqual(lastTrain);
    });

    test("rejects unsorted data with explicit error", () => {
        const data = makeLinearData(5);
        const unsorted = [data[0], data[2], data[1], data[3], data[4]];
        expect(() => TrainTestSplitter.splitChronological(unsorted, 0.6)).toThrow(/not chronologically sorted/);
    });

    test("edge case: 3 points, ratio=0.7 yields 2 train, 1 test", () => {
        const data = makeLinearData(3);
        const split = TrainTestSplitter.splitChronological(data, 0.7);
        expect(split.trainingCount).toBe(2);
        expect(split.testCount).toBe(1);
    });

    test("rejects invalid ratio", () => {
        const data = makeLinearData(10);
        expect(() => TrainTestSplitter.splitChronological(data, 0)).toThrow(/ratio/);
        expect(() => TrainTestSplitter.splitChronological(data, 1)).toThrow(/ratio/);
        expect(() => TrainTestSplitter.splitChronological(data, -0.1)).toThrow(/ratio/);
    });

    test("rejects empty data", () => {
        expect(() => TrainTestSplitter.splitChronological([], 0.5)).toThrow(/empty/);
    });
});

describe("ML Tenant isolation", () => {
    test("OLS rejects training data with mismatched tenant", () => {
        const data = makeLinearData(5, 2, 1, "tenant-x", "revenue");
        const model = LinearRegressionModel.train(data, singleFeatureSpec(), "tenant-a", "revenue");
        expect(model.status).toBe("not_converged");
    });

    test("OLS rejects training data with mismatched metric", () => {
        const data = makeLinearData(5, 2, 1, "tenant-a", "expenses");
        const model = LinearRegressionModel.train(data, singleFeatureSpec(), "tenant-a", "revenue");
        expect(model.status).toBe("not_converged");
    });
});

describe("Provenance fields", () => {
    test("LinearModel.modelId has all required fields", () => {
        const data = makeLinearData(10);
        const model = LinearRegressionModel.train(data, singleFeatureSpec(), "tenant-a", "revenue");
        expect(model.modelId.algorithm).toBe("ols_linear_regression");
        expect(typeof model.modelId.version).toBe("string");
        expect(model.modelId.tenantId).toBe("tenant-a");
        expect(model.modelId.metricName).toBe("revenue");
        expect(model.modelId.trainingWindow.start).toBeDefined();
        expect(model.modelId.trainingWindow.end).toBeDefined();
        expect(model.modelId.hyperparameters).toBeDefined();
    });

    test("EnsemblePrediction.provenance has all required fields", () => {
        const out = EnsembleAggregator.aggregate(
            [{ source: "a", value: 10 }, { source: "b", value: 20 }],
            { method: "mean", tenant: "tenant-a", metric: "revenue" }
        );
        expect(out.provenance.tenant).toBe("tenant-a");
        expect(out.provenance.metric).toBe("revenue");
        expect(out.provenance.calculatedAt).toBeDefined();
        expect(out.provenance.method).toMatch(/^ensemble_/);
    });
});

describe("Determinism across engines", () => {
    test("anomaly detection is deterministic", () => {
        const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
        const a = AnomalyDetector.detectAnomalies(data);
        for (let i = 0; i < 100; i++) {
            const b = AnomalyDetector.detectAnomalies(data);
            expect(b[9].isAnomaly).toBe(a[9].isAnomaly);
            expect(b[9].score).toBe(a[9].score);
        }
    });
});

describe("AnomalyDetector.explainAnomaly", () => {
    test("produces non-empty human-readable string for an anomaly", () => {
        const scores = AnomalyDetector.detectAnomalies([1, 2, 3, 4, 5, 100]);
        const text = AnomalyDetector.explainAnomaly(scores[5], { median: 3, mad: 1, threshold: 3.5 });
        expect(typeof text).toBe("string");
        expect(text.length).toBeGreaterThan(0);
        expect(text).toMatch(/anomalous/);
    });
});