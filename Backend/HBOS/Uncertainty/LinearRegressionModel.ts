/**
 * Stage 07-F - Linear Regression Model (OLS)
 *
 * Classical Ordinary Least Squares linear regression with no external
 * dependencies. Suitable for n_features <= 20 (small matrices handled
 * inline).
 *
 * METHOD:
 * - Closed-form normal equations:  beta = (X'X)^-1 X'Y
 * - The first column of X is an all-ones intercept column.
 * - Matrix inversion via Gauss-Jordan elimination with partial pivoting.
 * - If X'X is singular (or near-singular) the model returns
 *   status = "not_converged" rather than fabricating coefficients.
 *
 * IMPORTANT:
 * - No external matrix libraries; inline small-matrix operations only.
 * - Tenant isolation is enforced at the engine boundary.
 * - Reuses canonical Stage 07-A DescriptiveStatistics for metrics.
 * - Deterministic: identical inputs produce identical models.
 * - No fabricated confidence.
 */

import { DescriptiveStatistics } from "../Temporal/DescriptiveStatistics";
import {
    TrainingDataPoint,
    FeatureSpec,
    LinearModel,
    ModelIdentifier,
    ModelMetrics,
    ModelStatus
} from "./MLTypes";

const ALGORITHM_VERSION = "1.0.0";
const CANONICAL_TIMESTAMP = "2026-01-01T00:00:00Z";
const SINGULARITY_EPSILON = 1e-12;
const MIN_SAMPLES_FOR_TRAINING = 2;

export const LinearRegressionModel = {
    train(
        data: ReadonlyArray<TrainingDataPoint>,
        features: ReadonlyArray<FeatureSpec>,
        tenantId: string,
        metricName: string
    ): LinearModel {
        const baseId: Pick<ModelIdentifier, "algorithm" | "version" | "hyperparameters" | "tenantId" | "metricName"> = {
            algorithm: "ols_linear_regression",
            version: ALGORITHM_VERSION,
            hyperparameters: Object.freeze({
                method: "normal_equations",
                solver: "gauss_jordan_partial_pivot"
            }),
            tenantId,
            metricName
        };

        for (const p of data) {
            if (p.tenantId !== tenantId) {
                return notConvergedModel(baseId, features, data,
                    `tenant_isolation_violation: data point tenantId=${p.tenantId} does not match requested tenantId=${tenantId}`);
            }
            if (p.metricName !== metricName) {
                return notConvergedModel(baseId, features, data,
                    `metric_mismatch: data point metricName=${p.metricName} does not match requested metricName=${metricName}`);
            }
        }

        if (!data || data.length === 0) {
            return notConvergedModel(baseId, features, data, "empty_data", "insufficient_data");
        }

        const featureCount = features.length;
        const p = featureCount + 1;
        const n = data.length;

        if (n < MIN_SAMPLES_FOR_TRAINING) {
            return notConvergedModel(baseId, features, data,
                `insufficient_data: n=${n} < ${MIN_SAMPLES_FOR_TRAINING}`, "insufficient_data");
        }
        if (n <= featureCount) {
            return notConvergedModel(baseId, features, data,
                `insufficient_data: n=${n} <= p=${featureCount} (underdetermined)`, "insufficient_data");
        }

        const labels: number[] = [];
        const xMatrix: number[][] = [];
        for (const point of data) {
            if (typeof point.label !== "number" || !Number.isFinite(point.label)) {
                continue;
            }
            if (!point.features || point.features.length < featureCount) {
                return notConvergedModel(baseId, features, data,
                    "invalid_request: feature vector shorter than FeatureSpec count", "invalid_request");
            }
            let allFinite = true;
            for (let i = 0; i < featureCount; i++) {
                if (!Number.isFinite(point.features[i])) { allFinite = false; break; }
            }
            if (!allFinite) { continue; }
            const row = new Array<number>(p);
            row[0] = 1;
            for (let i = 0; i < featureCount; i++) {
                row[i + 1] = point.features[i];
            }
            xMatrix.push(row);
            labels.push(point.label);
        }

        const nUsed = labels.length;
        if (nUsed < MIN_SAMPLES_FOR_TRAINING) {
            return notConvergedModel(baseId, features, data,
                `insufficient_data: finite rows=${nUsed} < ${MIN_SAMPLES_FOR_TRAINING}`, "insufficient_data");
        }
        if (nUsed <= featureCount) {
            return notConvergedModel(baseId, features, data,
                `insufficient_data: finite rows=${nUsed} <= p=${featureCount} (underdetermined)`, "insufficient_data");
        }

        const sortedByTs = [...data].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        const windowStart = sortedByTs[0].timestamp;
        const windowEnd = sortedByTs[sortedByTs.length - 1].timestamp;

        const xtx: number[][] = makeMatrix(p, p, 0);
        const xty: number[] = new Array<number>(p).fill(0);

        for (let r = 0; r < nUsed; r++) {
            const xRow = xMatrix[r];
            const y = labels[r];
            for (let i = 0; i < p; i++) {
                xty[i] += xRow[i] * y;
                for (let j = 0; j < p; j++) {
                    xtx[i][j] += xRow[i] * xRow[j];
                }
            }
        }

        const augmented: number[][] = xtx.map((row, i) => {
            const out = row.slice();
            out.push(xty[i]);
            return out;
        });

        const inverted = invertMatrix(augmented);
        if (inverted === null) {
            return notConvergedModel(baseId, features, data,
                "not_converged: X'X is singular; features may be collinear or underdetermined",
                "not_converged", { start: windowStart, end: windowEnd });
        }

        const coefficients: number[] = new Array<number>(p);
        for (let i = 0; i < p; i++) {
            coefficients[i] = inverted[i][0];
        }

        let rss = 0;
        for (let r = 0; r < nUsed; r++) {
            const row = xMatrix[r];
            let pred = 0;
            for (let i = 0; i < p; i++) {
                pred += row[i] * coefficients[i];
            }
            const residual = labels[r] - pred;
            rss += residual * residual;
        }
        const tss = DescriptiveStatistics.sum(
            labels.map(y => Math.pow(y - DescriptiveStatistics.mean(labels), 2))
        );
        const rSquared = tss === 0 ? 0 : 1 - rss / tss;
        const dof = Math.max(nUsed - p, 1);
        const residualStandardError = Math.sqrt(rss / dof);

        const coefficientNames: string[] = ["(intercept)"];
        for (const f of features) {
            coefficientNames.push(f.name);
        }

        const modelId: ModelIdentifier = Object.freeze({
            ...baseId,
            trainingWindow: Object.freeze({ start: windowStart, end: windowEnd })
        });

        return Object.freeze({
            coefficients: Object.freeze(coefficients),
            coefficientNames: Object.freeze(coefficientNames),
            rss,
            tss,
            rSquared,
            trainingSampleCount: nUsed,
            featureCount,
            modelId,
            trainingWindow: Object.freeze({ start: windowStart, end: windowEnd }),
            status: "trained" as ModelStatus,
            residualStandardError
        });
    },

    predict(model: LinearModel, features: ReadonlyArray<number>): { value: number; standardError: number } {
        if (model.status !== "trained") { return { value: NaN, standardError: NaN }; }
        if (features.length !== model.featureCount) { return { value: NaN, standardError: NaN }; }
        let value = model.coefficients[0];
        for (let i = 0; i < model.featureCount; i++) {
            const xi = features[i];
            if (!Number.isFinite(xi)) { return { value: NaN, standardError: NaN }; }
            value += model.coefficients[i + 1] * xi;
        }
        return { value, standardError: model.residualStandardError };
    },

    evaluate(model: LinearModel, testData: ReadonlyArray<TrainingDataPoint>): ModelMetrics {
        if (model.status !== "trained") {
            return { mse: NaN, rmse: NaN, mae: NaN, rSquared: NaN, sampleCount: 0 };
        }

        const actuals: number[] = [];
        const predictions: number[] = [];

        for (const p of testData) {
            if (typeof p.label !== "number" || !Number.isFinite(p.label)) { continue; }
            if (!p.features || p.features.length < model.featureCount) { continue; }
            let allFinite = true;
            for (let i = 0; i < model.featureCount; i++) {
                if (!Number.isFinite(p.features[i])) { allFinite = false; break; }
            }
            if (!allFinite) { continue; }
            if (p.tenantId !== model.modelId.tenantId) { continue; }
            if (p.metricName !== model.modelId.metricName) { continue; }
            const pred = LinearRegressionModel.predict(model, p.features);
            if (!Number.isFinite(pred.value)) { continue; }
            actuals.push(p.label);
            predictions.push(pred.value);
        }

        if (actuals.length === 0) {
            return { mse: NaN, rmse: NaN, mae: NaN, rSquared: NaN, sampleCount: 0 };
        }

        const residuals = actuals.map((a, i) => a - predictions[i]);
        const mse = DescriptiveStatistics.mean(residuals.map(r => r * r));
        const rmse = Math.sqrt(mse);
        const mae = DescriptiveStatistics.mean(residuals.map(r => Math.abs(r)));
        const ssRes = DescriptiveStatistics.sum(residuals.map(r => r * r));
        const ssTot = DescriptiveStatistics.sum(
            actuals.map(a => Math.pow(a - DescriptiveStatistics.mean(actuals), 2))
        );
        const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

        let mape: number | undefined = undefined;
        if (actuals.every(a => a !== 0)) {
            mape = DescriptiveStatistics.mean(
                actuals.map((a, i) => Math.abs((a - predictions[i]) / a))
            );
        }

        const result: ModelMetrics = { mse, rmse, mae, rSquared, sampleCount: actuals.length };
        return Object.freeze(mape === undefined ? result : { ...result, mape });
    }
};

function makeMatrix(rows: number, cols: number, fill: number): number[][] {
    const m = new Array<number[]>(rows);
    for (let i = 0; i < rows; i++) {
        m[i] = new Array<number>(cols).fill(fill);
    }
    return m;
}

function invertMatrix(aug: number[][]): number[][] | null {
    const n = aug.length;
    if (n === 0) { return null; }
    const cols = aug[0].length;
    if (cols < n) { return null; }

    const M: number[][] = aug.map(row => row.slice());

    for (let i = 0; i < n; i++) {
        let pivotRow = i;
        let pivotVal = Math.abs(M[i][i]);
        for (let r = i + 1; r < n; r++) {
            const v = Math.abs(M[r][i]);
            if (v > pivotVal) {
                pivotVal = v;
                pivotRow = r;
            }
        }
        if (pivotVal < SINGULARITY_EPSILON) { return null; }
        if (pivotRow !== i) {
            const tmp = M[i];
            M[i] = M[pivotRow];
            M[pivotRow] = tmp;
        }
        const diag = M[i][i];
        for (let c = 0; c < cols; c++) {
            M[i][c] = M[i][c] / diag;
        }
        for (let r = 0; r < n; r++) {
            if (r === i) { continue; }
            const factor = M[r][i];
            if (factor === 0) { continue; }
            for (let c = 0; c < cols; c++) {
                M[r][c] = M[r][c] - factor * M[i][c];
            }
        }
    }

    const inv: number[][] = makeMatrix(n, n, 0);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            inv[i][j] = M[i][n + j];
        }
    }
    return inv;
}

function notConvergedModel(
    baseId: Pick<ModelIdentifier, "algorithm" | "version" | "hyperparameters" | "tenantId" | "metricName">,
    features: ReadonlyArray<FeatureSpec>,
    data: ReadonlyArray<TrainingDataPoint>,
    error: string,
    status: ModelStatus = "not_converged",
    windowOverride?: { start: string; end: string }
): LinearModel {
    const start = windowOverride?.start ?? data[0]?.timestamp ?? CANONICAL_TIMESTAMP;
    const end = windowOverride?.end ?? data[data.length - 1]?.timestamp ?? CANONICAL_TIMESTAMP;

    const coefficientNames = ["(intercept)"].concat(features.map(f => f.name));
    const modelId: ModelIdentifier = Object.freeze({
        ...baseId,
        trainingWindow: Object.freeze({ start, end })
    });
    return Object.freeze({
        coefficients: Object.freeze([]),
        coefficientNames: Object.freeze(coefficientNames),
        rss: NaN,
        tss: NaN,
        rSquared: NaN,
        trainingSampleCount: 0,
        featureCount: features.length,
        modelId,
        trainingWindow: Object.freeze({ start, end }),
        status,
        residualStandardError: NaN,
        error
    });
}
