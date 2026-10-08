/**
 * Stage 07-B - Data Quality Profiler
 *
 * Deterministic data quality assessment for temporal observations.
 *
 * Features:
 * - Missingness detection
 * - Duplicate timestamp detection
 * - Non-finite value detection
 * - Temporal gap analysis
 * - Coverage window calculation
 * - Deterministic results
 * - Explicit empty/insufficient-data states
 */

import {
    MetricObservation
} from "./TemporalTypes";
import {
    DataQualityProfile,
    MissingnessReport,
    DuplicateReport,
    NonFiniteReport,
    TemporalGapReport
} from "./BaselineTypes";

/**
 * DataQualityProfiler - Canonical data quality assessment
 */
export const DataQualityProfiler = {
    /**
     * Create a complete data quality profile for observations
     */
    profile(
        observations: readonly MetricObservation[],
        tenantId: string,
        metricName: string,
        timeWindow: { start: string; end: string }
    ): DataQualityProfile {
        const qualityFlags: string[] = [];

        // Missingness detection
        const missingness = profileMissingness(observations, timeWindow);

        // Duplicate detection
        const duplicates = detectDuplicates(observations);

        // Non-finite detection
        const nonFinite = detectNonFiniteValues(observations);

        // Temporal gaps
        const temporalGaps = analyzeTemporalGaps(observations);

        // Aggregate quality flags
        if (missingness && missingness.coveragePercent < 80) {
            qualityFlags.push("low-coverage");
        }
        if (duplicates && duplicates.count > 0) {
            qualityFlags.push("has-duplicates");
        }
        if (nonFinite && nonFinite.count > 0) {
            qualityFlags.push("has-non-finite");
        }
        if (temporalGaps && temporalGaps.maxGapDays > 30) {
            qualityFlags.push("large-temporal-gaps");
        }

        return Object.freeze({
            tenantId,
            metricName,
            timeWindow: Object.freeze({ ...timeWindow }),
            observationCount: observations.length,
            qualityFlags: Object.freeze([...qualityFlags]),
            missingness,
            duplicates,
            nonFiniteValues: nonFinite,
            temporalGaps
        });
    },

    /**
     * Check if data quality is sufficient for analysis
     */
    isQualitySufficient(profile: DataQualityProfile, minObservations: number = 2): boolean {
        if (profile.observationCount < minObservations) {
            return false;
        }
        // Non-finite values disqualify
        if (profile.nonFiniteValues && profile.nonFiniteValues.count > 0) {
            return false;
        }
        return true;
    },

    /**
     * Get summary quality flags
     */
    getQualityFlags(profile: DataQualityProfile): ReadonlyArray<string> {
        return profile.qualityFlags;
    }
};

/**
 * Profile missingness in observation sequence
 */
function profileMissingness(
    observations: readonly MetricObservation[],
    timeWindow: { start: string; end: string }
): MissingnessReport | null {
    if (observations.length === 0) {
        return Object.freeze({
            gaps: Object.freeze([]),
            totalMissingDays: calculateDaysBetween(timeWindow.start, timeWindow.end),
            coveragePercent: 0
        });
    }

    const gaps: Array<{ start: string; end: string; durationDays: number }> = [];
    const sorted = [...observations].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const windowStart = new Date(timeWindow.start).getTime();
    const windowEnd = new Date(timeWindow.end).getTime();
    const windowDays = (windowEnd - windowStart) / (1000 * 60 * 60 * 24);

    // Check gap at start
    const firstObsTime = new Date(sorted[0].timestamp).getTime();
    if (firstObsTime > windowStart + 1000 * 60 * 60 * 24) {
        // More than 1 day gap at start
        const gapDays = (firstObsTime - windowStart) / (1000 * 60 * 60 * 24);
        gaps.push({
            start: timeWindow.start,
            end: sorted[0].timestamp,
            durationDays: Math.round(gapDays * 1000) / 1000
        });
    }

    // Check gaps between observations
    for (let i = 1; i < sorted.length; i++) {
        const prevTime = new Date(sorted[i-1].timestamp).getTime();
        const currTime = new Date(sorted[i].timestamp).getTime();
        const gapDays = (currTime - prevTime) / (1000 * 60 * 60 * 24);

        // Only report gaps > 1 day
        if (gapDays > 1) {
            gaps.push({
                start: sorted[i-1].timestamp,
                end: sorted[i].timestamp,
                durationDays: Math.round(gapDays * 1000) / 1000
            });
        }
    }

    // Check gap at end
    const lastObsTime = new Date(sorted[sorted.length - 1].timestamp).getTime();
    if (lastObsTime < windowEnd - 1000 * 60 * 60 * 24) {
        const gapDays = (windowEnd - lastObsTime) / (1000 * 60 * 60 * 24);
        gaps.push({
            start: sorted[sorted.length - 1].timestamp,
            end: timeWindow.end,
            durationDays: Math.round(gapDays * 1000) / 1000
        });
    }

    const totalMissingDays = gaps.reduce((sum, g) => sum + g.durationDays, 0);
    const coveragePercent = Math.round((1 - totalMissingDays / windowDays) * 10000) / 100;

    return Object.freeze({
        gaps: Object.freeze(gaps),
        totalMissingDays: Math.round(totalMissingDays * 1000) / 1000,
        coveragePercent: Math.max(0, Math.min(100, coveragePercent))
    });
}

/**
 * Detect duplicate timestamps
 */
function detectDuplicates(observations: readonly MetricObservation[]): DuplicateReport | null {
    const timestampCounts = new Map<string, number>();

    for (const obs of observations) {
        const count = timestampCounts.get(obs.timestamp) || 0;
        timestampCounts.set(obs.timestamp, count + 1);
    }

    const duplicates: string[] = [];
    for (const [timestamp, count] of timestampCounts) {
        if (count > 1) {
            duplicates.push(timestamp);
        }
    }

    if (duplicates.length === 0) {
        return null;
    }

    return Object.freeze({
        duplicateTimestamps: Object.freeze([...duplicates]),
        count: duplicates.length
    });
}

/**
 * Detect non-finite values
 */
function detectNonFiniteValues(observations: readonly MetricObservation[]): NonFiniteReport | null {
    const invalidValues: Array<{ timestamp: string; value: number }> = [];

    for (const obs of observations) {
        if (!Number.isFinite(obs.value)) {
            invalidValues.push({
                timestamp: obs.timestamp,
                value: obs.value
            });
        }
    }

    if (invalidValues.length === 0) {
        return null;
    }

    return Object.freeze({
        invalidValues: Object.freeze(invalidValues),
        count: invalidValues.length
    });
}

/**
 * Analyze temporal gaps
 */
function analyzeTemporalGaps(observations: readonly MetricObservation[]): TemporalGapReport | null {
    if (observations.length < 2) {
        return Object.freeze({
            gaps: Object.freeze([]),
            maxGapDays: 0,
            avgGapDays: 0
        });
    }

    const sorted = [...observations].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const gaps: Array<{ before: string; after: string; durationDays: number }> = [];

    for (let i = 1; i < sorted.length; i++) {
        const prevTime = new Date(sorted[i-1].timestamp).getTime();
        const currTime = new Date(sorted[i].timestamp).getTime();
        const gapDays = (currTime - prevTime) / (1000 * 60 * 60 * 24);

        if (gapDays > 0) {
            gaps.push({
                before: sorted[i-1].timestamp,
                after: sorted[i].timestamp,
                durationDays: Math.round(gapDays * 1000) / 1000
            });
        }
    }

    if (gaps.length === 0) {
        return Object.freeze({
            gaps: Object.freeze([]),
            maxGapDays: 0,
            avgGapDays: 0
        });
    }

    const maxGapDays = Math.max(...gaps.map(g => g.durationDays));
    const avgGapDays = gaps.reduce((sum, g) => sum + g.durationDays, 0) / gaps.length;

    return Object.freeze({
        gaps: Object.freeze(gaps),
        maxGapDays: Math.round(maxGapDays * 1000) / 1000,
        avgGapDays: Math.round(avgGapDays * 1000) / 1000
    });
}

/**
 * Calculate days between two ISO timestamps
 */
function calculateDaysBetween(start: string, end: string): number {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    return Math.round(((endTime - startTime) / (1000 * 60 * 60 * 24)) * 1000) / 1000;
}
