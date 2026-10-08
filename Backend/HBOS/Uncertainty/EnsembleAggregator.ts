/**
 * Stage 07-F - Ensemble Aggregator
 *
 * Deterministic ensemble of multiple forecasting / estimation sources.
 *
 * METHODS:
 * - mean      : simple arithmetic mean of values
 * - median    : median of values (robust to a single outlier source)
 * - weighted  : weighted arithmetic mean; weights are normalized to
 *               sum to 1 when the caller provides them; default weight
 *               is 1 / N (equal weighting) if not provided.
 *
 * IMPORTANT:
 * - Reuses canonical Stage 07-A DescriptiveStatistics for mean/median.
 * - No fabricated confidence; aggregated value is the only point estimate.
 * - Tenant + metric + method are surfaced in provenance.
 * - All outputs are immutable (Object.freeze).
 * - Deterministic: identical inputs produce identical outputs.
 */

import { DescriptiveStatistics } from "../Temporal/DescriptiveStatistics";
import { EnsemblePrediction, ModelMetrics, Provenance } from "./MLTypes";

const CANONICAL_TIMESTAMP = "2026-01-01T00:00:00Z";

export interface SourcePrediction {
    readonly source: string;
    readonly value: number;
    readonly weight?: number;
}

export interface AggregateOptions {
    readonly method: "mean" | "median" | "weighted";
    readonly tenant: string;
    readonly metric: string;
    readonly source?: string;
    readonly modelId?: Provenance["modelId"];
    readonly trainingWindow?: Provenance["trainingWindow"];
}

export const EnsembleAggregator = {
    aggregate(predictions: ReadonlyArray<SourcePrediction>, options: AggregateOptions): EnsemblePrediction {
        const method = options.method;

        if (!predictions || predictions.length === 0) {
            const provenance: Provenance = Object.freeze({
                source: options.source ?? "ensemble-aggregator",
                tenant: options.tenant,
                metric: options.metric,
                modelId: options.modelId,
                trainingWindow: options.trainingWindow,
                calculatedAt: CANONICAL_TIMESTAMP,
                method: `ensemble_${method}`
            });
            return Object.freeze({
                modelPredictions: Object.freeze([]),
                aggregated: NaN,
                method,
                weights: Object.freeze([]),
                sourceCount: 0,
                provenance
            });
        }

        const values = predictions.map(p => p.value);
        const finiteMask = values.map(v => Number.isFinite(v));

        const n = predictions.length;
        const rawWeights = predictions.map(p =>
            typeof p.weight === "number" && Number.isFinite(p.weight) && p.weight >= 0
                ? p.weight
                : 1
        );
        const weightSum = rawWeights.reduce((a, b) => a + b, 0);
        const normalizedWeights = weightSum > 0
            ? rawWeights.map(w => w / weightSum)
            : rawWeights.map(_ => 1 / n);

        let aggregated: number;
        if (method === "mean") {
            const finiteValues = values.filter((_, i) => finiteMask[i]);
            aggregated = finiteValues.length === 0 ? NaN : DescriptiveStatistics.mean(finiteValues);
        } else if (method === "median") {
            const finiteValues = values.filter((_, i) => finiteMask[i]);
            aggregated = finiteValues.length === 0 ? NaN : DescriptiveStatistics.median(finiteValues);
        } else {
            let num = 0;
            let usedWeight = 0;
            for (let i = 0; i < n; i++) {
                if (finiteMask[i]) {
                    num += values[i] * normalizedWeights[i];
                    usedWeight += normalizedWeights[i];
                }
            }
            aggregated = usedWeight === 0 ? NaN : num / usedWeight;
        }

        const modelPredictions = predictions.map((p, i) =>
            Object.freeze({ source: p.source, value: p.value, weight: normalizedWeights[i] })
        );

        const provenance: Provenance = Object.freeze({
            source: options.source ?? "ensemble-aggregator",
            tenant: options.tenant,
            metric: options.metric,
            modelId: options.modelId,
            trainingWindow: options.trainingWindow,
            calculatedAt: CANONICAL_TIMESTAMP,
            method: `ensemble_${method}`
        });

        return Object.freeze({
            modelPredictions: Object.freeze(modelPredictions),
            aggregated,
            method,
            weights: Object.freeze(normalizedWeights),
            sourceCount: n,
            provenance
        });
    },

    evaluateEnsemble(ensemble: EnsemblePrediction, actuals: ReadonlyArray<number>): ModelMetrics {
        if (!actuals || actuals.length === 0) {
            return { mse: NaN, rmse: NaN, mae: NaN, rSquared: NaN, sampleCount: 0 };
        }
        if (!Number.isFinite(ensemble.aggregated)) {
            return { mse: NaN, rmse: NaN, mae: NaN, rSquared: NaN, sampleCount: 0 };
        }
        const finiteActuals = actuals.filter(a => Number.isFinite(a));
        if (finiteActuals.length === 0) {
            return { mse: NaN, rmse: NaN, mae: NaN, rSquared: NaN, sampleCount: 0 };
        }
        const residuals = finiteActuals.map(a => a - ensemble.aggregated);
        const mse = DescriptiveStatistics.mean(residuals.map(r => r * r));
        const rmse = Math.sqrt(mse);
        const mae = DescriptiveStatistics.mean(residuals.map(r => Math.abs(r)));
        const ssRes = DescriptiveStatistics.sum(residuals.map(r => r * r));
        const ssTot = DescriptiveStatistics.sum(
            finiteActuals.map(a => Math.pow(a - DescriptiveStatistics.mean(finiteActuals), 2))
        );
        const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

        let mape: number | undefined = undefined;
        if (finiteActuals.every(a => a !== 0)) {
            mape = DescriptiveStatistics.mean(
                finiteActuals.map(a => Math.abs((a - ensemble.aggregated) / a))
            );
        }

        const result: ModelMetrics = { mse, rmse, mae, rSquared, sampleCount: finiteActuals.length };
        return Object.freeze(mape === undefined ? result : { ...result, mape });
    }
};
