/**
 * Stage 07-F - ML / Ensemble / Anomaly Types
 *
 * Contract types for classical ML capability, ensemble aggregation,
 * and robust anomaly detection.
 *
 * IMPORTANT:
 * - No fabricated confidence
 * - All outputs are immutable (Object.freeze at construction)
 * - Tenant isolation enforced at every engine boundary
 * - Determinism: identical inputs produce identical outputs
 * - No external ML dependencies; inline small-matrix OLS only
 */

export interface TrainingDataPoint {
    readonly timestamp: string;
    readonly features: ReadonlyArray<number>;
    readonly label?: number;
    readonly tenantId: string;
    readonly metricName: string;
}

export interface FeatureSpec {
    readonly name: string;
    readonly index: number;
    readonly isCategorical: boolean;
    readonly encoding: "passthrough" | "one_hot" | "label" | "binary";
}

export interface LinearModel {
    readonly coefficients: ReadonlyArray<number>;
    readonly coefficientNames: ReadonlyArray<string>;
    readonly rss: number;
    readonly tss: number;
    readonly rSquared: number;
    readonly trainingSampleCount: number;
    readonly featureCount: number;
    readonly modelId: ModelIdentifier;
    readonly trainingWindow: {
        readonly start: string;
        readonly end: string;
    };
    readonly status: ModelStatus;
    readonly residualStandardError: number;
    readonly error?: string;
}

export interface ModelIdentifier {
    readonly algorithm: "ols_linear_regression";
    readonly version: string;
    readonly trainingWindow: {
        readonly start: string;
        readonly end: string;
    };
    readonly hyperparameters: Readonly<Record<string, number | string | boolean>>;
    readonly tenantId: string;
    readonly metricName: string;
}

export interface ModelMetrics {
    readonly mse: number;
    readonly rmse: number;
    readonly mae: number;
    readonly rSquared: number;
    readonly mape?: number;
    readonly sampleCount: number;
}

export interface TrainTestSplit {
    readonly trainingData: ReadonlyArray<TrainingDataPoint>;
    readonly testData: ReadonlyArray<TrainingDataPoint>;
    readonly splitRatio: number;
    readonly trainingCount: number;
    readonly testCount: number;
    readonly boundaryTimestamp: string;
    readonly noFutureLeakage: boolean;
}

export interface AnomalyScore {
    readonly index: number;
    readonly value: number;
    readonly score: number;
    readonly threshold: number;
    readonly isAnomaly: boolean;
    readonly reason: string;
    readonly contributingFeatures: ReadonlyArray<{ name: string; contribution: number }>;
}

export interface EnsemblePrediction {
    readonly modelPredictions: ReadonlyArray<{
        readonly source: string;
        readonly value: number;
        readonly weight: number;
    }>;
    readonly aggregated: number;
    readonly method: "mean" | "median" | "weighted";
    readonly weights: ReadonlyArray<number>;
    readonly sourceCount: number;
    readonly provenance: Provenance;
}

export interface Provenance {
    readonly source: string;
    readonly tenant: string;
    readonly metric: string;
    readonly modelId?: ModelIdentifier;
    readonly trainingWindow?: {
        readonly start: string;
        readonly end: string;
    };
    readonly calculatedAt: string;
    readonly method: string;
}

export type ModelStatus =
    | "trained"
    | "insufficient_data"
    | "invalid_request"
    | "converged"
    | "not_converged";
