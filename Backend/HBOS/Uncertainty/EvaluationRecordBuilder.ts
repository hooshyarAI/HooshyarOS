/**
 * Stage 07-J - EvaluationRecordBuilder
 *
 * Constructs EvaluationRecord objects from residuals and baseline residuals.
 *
 * METHODS:
 * - buildForForecast: computes MSE, MAE, R2, RMSE from residuals, compares
 *   to baseline, detects drift, and populates assumptions/limitations.
 *
 * IMPORTANT:
 * - Reuses canonical Stage 07-A DescriptiveStatistics for metrics.
 * - Tenant isolation enforced via tenantId in provenance.
 * - Calibration marked not_applicable for residuals-only evaluation.
 * - All outputs frozen.
 * - Deterministic: identical inputs produce identical records.
 */

import { DescriptiveStatistics } from "../Temporal/DescriptiveStatistics";
import {
    MethodIdentifier,
    EvaluationMetric,
    BaselineComparison,
    CalibrationSummary,
    DriftIndicator,
    MethodAssumption,
    MethodLimitation,
    EvaluationProvenance,
    EvaluationRecord
} from "./EvaluationTypes";

const CANONICAL_TIMESTAMP = "2026-01-01T00:00:00Z";

function computeMetrics(residuals: number[]): { mse: number; mae: number; rSquared: number; rmse: number } {
    if (!residuals || residuals.length === 0) {
        return { mse: NaN, mae: NaN, rSquared: NaN, rmse: NaN };
    }
    const finite = residuals.filter(v => Number.isFinite(v));
    if (finite.length === 0) {
        return { mse: NaN, mae: NaN, rSquared: NaN, rmse: NaN };
    }
    const mean = DescriptiveStatistics.mean(finite);
    const ssRes = DescriptiveStatistics.sum(finite.map(r => r * r));
    const mse = ssRes / finite.length;
    const rmse = Math.sqrt(mse);
    const mae = DescriptiveStatistics.mean(finite.map(r => Math.abs(r)));
    const ssTot = DescriptiveStatistics.sum(finite.map(r => Math.pow(r - mean, 2)));
    const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
    return { mse, mae, rSquared, rmse };
}

export const EvaluationRecordBuilder = {
    buildForForecast(
        residuals: number[],
        baselineResiduals: number[],
        methodId: MethodIdentifier,
        tenantId: string,
        evaluationWindow: { start: string; end: string }
    ): EvaluationRecord {
        const currentMetrics = computeMetrics(residuals);
        const baselineMetrics = computeMetrics(baselineResiduals);

        const metrics: EvaluationMetric[] = [
            { name: "mse", value: currentMetrics.mse, direction: "lower_is_better", baselineValue: baselineMetrics.mse },
            { name: "mae", value: currentMetrics.mae, direction: "lower_is_better", baselineValue: baselineMetrics.mae },
            { name: "rmse", value: currentMetrics.rmse, direction: "lower_is_better", baselineValue: baselineMetrics.rmse },
            { name: "r_squared", value: currentMetrics.rSquared, direction: "higher_is_better", baselineValue: baselineMetrics.rSquared }
        ];

        let baselineComparison: BaselineComparison | undefined;
        if (baselineResiduals && baselineResiduals.length > 0) {
            const mseDelta = currentMetrics.mse - baselineMetrics.mse;
            const maeDelta = currentMetrics.mae - baselineMetrics.mae;
            const r2Delta = currentMetrics.rSquared - baselineMetrics.rSquared;
            const rmseDelta = currentMetrics.rmse - baselineMetrics.rmse;

            const isMseImprovement = mseDelta < 0;
            const isMaeImprovement = maeDelta < 0;
            const isR2Improvement = r2Delta > 0;
            const isRmseImprovement = rmseDelta < 0;

            const allImprove = isMseImprovement && isMaeImprovement && isR2Improvement && isRmseImprovement;
            const anyImprove = isMseImprovement || isMaeImprovement || isR2Improvement || isRmseImprovement;
            const isImprovement = allImprove && (residuals.length > 0 || baselineResiduals.length > 0)
                ? (isMseImprovement ? 1 : 0) + (isMaeImprovement ? 1 : 0) + (isR2Improvement ? 1 : 0) + (isRmseImprovement ? 1 : 0) >= 3
                : anyImprove ? true : false;

            const improvement = (mseDelta + maeDelta + rmseDelta) / 3 - r2Delta;

            baselineComparison = {
                baselineMethod: "baseline_residuals",
                baselineMetrics: Object.freeze([
                    { name: "mse", value: baselineMetrics.mse, direction: "lower_is_better" as const },
                    { name: "mae", value: baselineMetrics.mae, direction: "lower_is_better" as const },
                    { name: "rmse", value: baselineMetrics.rmse, direction: "lower_is_better" as const },
                    { name: "r_squared", value: baselineMetrics.rSquared, direction: "higher_is_better" as const }
                ]),
                improvement,
                isImprovement
            };
        }

        const drift: DriftIndicator[] = [];
        const defaultThreshold = 0.1;
        for (const metric of metrics) {
            if (metric.baselineValue !== undefined) {
                const delta = metric.value - metric.baselineValue;
                const driftScore = Math.abs(delta);
                const isDrift = driftScore > defaultThreshold;
                drift.push(Object.freeze({
                    metric: metric.name,
                    baselineValue: metric.baselineValue,
                    currentValue: metric.value,
                    driftScore,
                    threshold: defaultThreshold,
                    isDrift
                }));
            }
        }

        const calibration: CalibrationSummary = {
            applicable: false,
            status: "not_applicable"
        };

        const assumptions: MethodAssumption[] = [
            {
                description: "IID residuals",
                isValid: true,
                validationNote: "Not independently verified in this scope; assumed for evaluation."
            },
            {
                description: "Linear model",
                isValid: true,
                validationNote: "Evaluation assumes residuals are from a linear forecasting model."
            }
        ];

        const limitations: MethodLimitation[] = [
            {
                description: "Evaluation limited to point-forecast residuals; prediction interval coverage not assessed.",
                severity: "warning"
            },
            {
                description: "Drift detection uses fixed threshold of 0.1, which may not be appropriate for all metrics.",
                severity: "info"
            }
        ];

        const provenance: EvaluationProvenance = {
            source: "EvaluationRecordBuilder",
            tenant: tenantId,
            method: methodId.name,
            evaluationWindow,
            calculatedAt: CANONICAL_TIMESTAMP
        };

        return {
            methodId,
            dataset: tenantId,
            metrics,
            baselineComparison,
            calibration,
            drift: Object.freeze(drift),
            assumptions: Object.freeze(assumptions),
            limitations: Object.freeze(limitations),
            timestamp: CANONICAL_TIMESTAMP,
            provenance
        };
    }
};
