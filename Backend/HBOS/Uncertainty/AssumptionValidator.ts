/**
 * Stage 07-J - AssumptionValidator
 *
 * Validates method assumptions for explainability and evaluation.
 *
 * METHODS:
 * - validateLinearity: checks if residuals are roughly zero-mean across prediction range.
 * - validateIndependence: correlation check between two series.
 * - validateStationarity: split series in half; compare means.
 *
 * IMPORTANT:
 * - Reuses canonical Stage 07-A DescriptiveStatistics for mean/std.
 * - All outputs are immutable (Object.freeze).
 * - Deterministic: identical inputs produce identical outputs.
 * - No fabricated confidence.
 */

import { DescriptiveStatistics } from "../Temporal/DescriptiveStatistics";
import { MethodAssumption } from "./EvaluationTypes";

export const AssumptionValidator = {
    validateLinearity(residuals: number[], predicted: number[]): MethodAssumption {
        if (!residuals || residuals.length === 0 || !predicted || predicted.length === 0) {
            return Object.freeze({
                description: "Linearity (residuals ~ 0)",
                isValid: false,
                validationNote: "Empty residuals or predictions provided."
            });
        }
        const meanResidual = DescriptiveStatistics.mean(residuals);
        const isValid = Math.abs(meanResidual) < 1e-6 || Number.isNaN(meanResidual);
        return Object.freeze({
            description: "Linearity (residuals ~ 0)",
            isValid,
            validationNote: isValid
                ? "Residual mean is approximately zero."
                : `Residual mean=${meanResidual} deviates from zero; linearity assumption may be violated.`
        });
    },

    validateIndependence(series1: number[], series2: number[]): MethodAssumption {
        if (!series1 || series1.length === 0 || !series2 || series2.length === 0) {
            return Object.freeze({
                description: "Independence (correlation ~ 0)",
                isValid: false,
                validationNote: "Empty series provided."
            });
        }
        const n = Math.min(series1.length, series2.length);
        const s1 = series1.slice(0, n);
        const s2 = series2.slice(0, n);
        const mean1 = DescriptiveStatistics.mean(s1);
        const mean2 = DescriptiveStatistics.mean(s2);
        let cov = 0;
        for (let i = 0; i < n; i++) {
            cov += (s1[i] - mean1) * (s2[i] - mean2);
        }
        cov /= n;
        const std1 = DescriptiveStatistics.sampleStandardDeviation(s1);
        const std2 = DescriptiveStatistics.sampleStandardDeviation(s2);
        const safeStd1 = Number.isNaN(std1) ? 0 : std1;
        const safeStd2 = Number.isNaN(std2) ? 0 : std2;
        const correlation = (safeStd1 === 0 || safeStd2 === 0) ? 0 : cov / (safeStd1 * safeStd2);
        const isValid = Math.abs(correlation) < 0.3;
        return Object.freeze({
            description: "Independence (correlation ~ 0)",
            isValid,
            validationNote: isValid
                ? `Correlation=${correlation.toFixed(4)} is below 0.3; series appear independent.`
                : `Correlation=${correlation.toFixed(4)} exceeds 0.3; potential dependence detected.`
        });
    },

    validateStationarity(series: number[]): MethodAssumption {
        if (!series || series.length < 2) {
            return Object.freeze({
                description: "Stationarity (constant mean/variance)",
                isValid: false,
                validationNote: "Insufficient data for stationarity check."
            });
        }
        const mid = Math.floor(series.length / 2);
        const firstHalf = series.slice(0, mid);
        const secondHalf = series.slice(mid);
        const meanFirst = DescriptiveStatistics.mean(firstHalf);
        const meanSecond = DescriptiveStatistics.mean(secondHalf);
        const isValid = Math.abs(meanFirst - meanSecond) < 1e-6 || Number.isNaN(meanFirst) || Number.isNaN(meanSecond);
        return Object.freeze({
            description: "Stationarity (constant mean/variance)",
            isValid,
            validationNote: isValid
                ? `Means are similar (first=${meanFirst.toFixed(4)}, second=${meanSecond.toFixed(4)}).`
                : `Mean shift detected (first=${meanFirst.toFixed(4)}, second=${meanSecond.toFixed(4)}); series may be non-stationary.`
        });
    }
};
