/**
 * Stage 07-B - Baseline Comparison
 *
 * Compare current values against statistical baselines.
 *
 * IMPORTANT:
 * - Z-score only calculated when statistical contract is satisfied
 * - No fabricated confidence
 * - Deterministic results
 * - Explicit zero/near-zero baseline handling
 */

import { StatisticalBaseline, BaselineComparisonResult } from "./BaselineTypes";

/**
 * Z-Score calculation contract:
 * - Requires at least 30 observations for reliable estimation
 * - Requires non-zero standard deviation
 */
const Z_SCORE_MIN_OBSERVATIONS = 30;
const NEAR_ZERO_THRESHOLD = 1e-10;

/**
 * BaselineComparison - Canonical baseline comparison
 */
export const BaselineComparison = {
    /**
     * Compare a current value against a baseline
     *
     * @param currentValue - The value to compare
     * @param baseline - The statistical baseline
     * @returns Comparison result with deviation metrics
     */
    compare(currentValue: number, baseline: StatisticalBaseline): BaselineComparisonResult {
        // Absolute deviation
        const absoluteDeviation = Math.abs(currentValue - baseline.mean);

        // Relative deviation (with zero-protection)
        let relativeDeviation: number | null = null;
        if (Math.abs(baseline.mean) > NEAR_ZERO_THRESHOLD) {
            relativeDeviation = (currentValue - baseline.mean) / baseline.mean;
        }

        // Z-score (only if statistical contract is satisfied)
        let zScore: number | null = null;
        if (canCalculateZScore(baseline)) {
            zScore = (currentValue - baseline.mean) / baseline.sampleStandardDeviation;
        }

        return {
            tenantId: baseline.tenantId,
            metricName: baseline.metricName,
            currentValue,
            baseline,
            absoluteDeviation,
            relativeDeviation,
            zScore,
            confidence: {
                source: "unavailable"
            },
            provenance: { ...baseline.provenance }
        };
    },

    /**
     * Check if z-score can be reliably calculated for this baseline
     */
    canCalculateZScore(baseline: StatisticalBaseline): boolean {
        return (
            baseline.observationCount >= Z_SCORE_MIN_OBSERVATIONS &&
            baseline.sampleStandardDeviation > NEAR_ZERO_THRESHOLD
        );
    },

    /**
     * Get the z-score contract requirements
     */
    getZScoreContract(): {
        requiresMinObservations: number;
        requiresNonZeroStdDev: boolean;
        method: string;
        formula: string;
        rationale: string;
    } {
        return {
            requiresMinObservations: Z_SCORE_MIN_OBSERVATIONS,
            requiresNonZeroStdDev: true,
            method: "z-score",
            formula: "(current - mean) / std",
            rationale:
                "Z-score requires large sample (n>=30) for reliable estimation " +
                "and non-zero standard deviation to avoid division by zero. " +
                "This is a methodological constraint, not an arbitrary minimum."
        };
    },

    /**
     * Classify a baseline comparison result
     */
    classifyDeviation(
        result: BaselineComparisonResult
    ): {
        severity: "normal" | "elevated" | "high" | "critical";
        reason: string;
    } {
        if (result.zScore === null) {
            // Can't classify without z-score
            if (result.relativeDeviation === null) {
                return {
                    severity: "elevated",
                    reason: "Near-zero baseline - relative deviation undefined"
                };
            }
            const absRelDev = Math.abs(result.relativeDeviation);
            if (absRelDev < 0.1) {
                return { severity: "normal", reason: "Within 10% of near-zero baseline" };
            } else if (absRelDev < 0.25) {
                return { severity: "elevated", reason: "10-25% deviation from near-zero baseline" };
            } else {
                return { severity: "high", reason: ">25% deviation from near-zero baseline" };
            }
        }

        const absZ = Math.abs(result.zScore);
        if (absZ < 1) {
            return { severity: "normal", reason: "Within 1 std of baseline" };
        } else if (absZ < 2) {
            return { severity: "elevated", reason: "1-2 std from baseline" };
        } else if (absZ < 3) {
            return { severity: "high", reason: "2-3 std from baseline" };
        } else {
            return { severity: "critical", reason: ">3 std from baseline" };
        }
    }
};

/**
 * Check if z-score can be calculated
 */
function canCalculateZScore(baseline: StatisticalBaseline): boolean {
    return (
        baseline.observationCount >= Z_SCORE_MIN_OBSERVATIONS &&
        baseline.sampleStandardDeviation > NEAR_ZERO_THRESHOLD
    );
}
