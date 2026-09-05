/**
 * Stage 07-A - Temporal Aggregator
 *
 * Deterministic temporal aggregation for observations.
 *
 * Aggregation periods:
 * - daily: Calendar day (00:00:00 to 23:59:59.999)
 * - weekly: ISO week (Monday 00:00:00 to Sunday 23:59:59.999)
 * - monthly: Calendar month
 *
 * IMPORTANT: All aggregations are deterministic and reproducible.
 * The same input observations will always produce the same aggregated output.
 */

import {
    MetricObservation,
    AggregatedMetric,
    AggregationPeriod
} from "./TemporalTypes";

/**
 * ISO week number calculation
 * Returns 1-53 for the ISO week number
 */
export function getISOWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNum;
}

/**
 * Get period boundaries for a given timestamp
 * Uses UTC consistently to avoid timezone issues
 */
export function getPeriodBoundaries(
    timestamp: string,
    period: AggregationPeriod
): { start: Date; end: Date } {
    // Parse as UTC to ensure consistent behavior regardless of local timezone
    const date = new Date(timestamp);
    const utcYear = date.getUTCFullYear();
    const utcMonth = date.getUTCMonth();
    const utcDate = date.getUTCDate();
    const utcDay = date.getUTCDay();

    if (period === "daily") {
        const start = new Date(Date.UTC(utcYear, utcMonth, utcDate, 0, 0, 0, 0));
        const end = new Date(Date.UTC(utcYear, utcMonth, utcDate, 23, 59, 59, 999));
        return { start, end };
    }

    if (period === "weekly") {
        // ISO week: week starts on Monday
        // UTC day: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        // Days from Monday: if Sunday (0), go forward 1 day; otherwise, daysToMonday = 1 - day
        const daysToMonday = utcDay === 0 ? 1 : 1 - utcDay;
        const monday = new Date(Date.UTC(utcYear, utcMonth, utcDate + daysToMonday, 0, 0, 0, 0));
        const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
        return { start: monday, end: sunday };
    }

    if (period === "monthly") {
        const start = new Date(Date.UTC(utcYear, utcMonth, 1, 0, 0, 0, 0));
        const nextMonth = new Date(Date.UTC(utcYear, utcMonth + 1, 1, 0, 0, 0, 0));
        const end = new Date(nextMonth.getTime() - 1);
        return { start, end };
    }

    throw new Error(`Unknown aggregation period: ${period}`);
}

/**
 * Format period start to ISO string for storage
 */
export function formatPeriodStart(date: Date): string {
    return date.toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * Format period end to ISO string for storage
 */
export function formatPeriodEnd(date: Date): string {
    // Return the last moment of the period as YYYY-MM-DDTHH:mm:ss.sssZ
    return date.toISOString();
}

/**
 * Get a unique key for a period
 */
export function getPeriodKey(
    tenantId: string,
    metricName: string,
    timestamp: string,
    period: AggregationPeriod
): string {
    const { start } = getPeriodBoundaries(timestamp, period);
    return `${tenantId}:${metricName}:${period}:${formatPeriodStart(start)}`;
}

/**
 * Group observations by period
 */
export function groupByPeriod(
    observations: readonly MetricObservation[],
    period: AggregationPeriod
): Map<string, MetricObservation[]> {
    const groups = new Map<string, MetricObservation[]>();

    for (const obs of observations) {
        const key = getPeriodKey(obs.tenantId, obs.metricName, obs.timestamp, period);
        const existing = groups.get(key) || [];
        existing.push(obs);
        groups.set(key, existing);
    }

    return groups;
}

/**
 * TemporalAggregator - Creates aggregated metrics from observations
 */
export const TemporalAggregator = {
    /**
     * Aggregate observations by period
     */
    aggregate(
        observations: readonly MetricObservation[],
        period: AggregationPeriod,
        source: string
    ): readonly AggregatedMetric[] {
        if (!observations || observations.length === 0) {
            return [];
        }

        const groups = groupByPeriod(observations, period);
        const results: AggregatedMetric[] = [];

        for (const [_key, group] of groups) {
            if (group.length === 0) continue;

            // Sort by timestamp
            const sorted = [...group].sort((a, b) =>
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );

            const { start, end } = getPeriodBoundaries(sorted[0].timestamp, period);
            const values = sorted.map(o => o.value);

            const sum = values.reduce((acc, v) => acc + v, 0);
            const mean = sum / values.length;
            const sortedValues = [...values].sort((a, b) => a - b);
            const min = sortedValues[0];
            const max = sortedValues[sortedValues.length - 1];
            const firstValue = sorted[0].value;
            const lastValue = sorted[sorted.length - 1].value;

            results.push({
                tenantId: sorted[0].tenantId,
                metricName: sorted[0].metricName,
                period,
                periodStart: formatPeriodStart(start),
                periodEnd: formatPeriodEnd(end),
                observationCount: sorted.length,
                sum: Math.round(sum * 1000000) / 1000000, // 6 decimal precision
                mean: Math.round(mean * 1000000) / 1000000,
                min,
                max,
                firstValue,
                lastValue,
                firstTimestamp: sorted[0].timestamp,
                lastTimestamp: sorted[sorted.length - 1].timestamp,
                source
            });
        }

        // Sort by period start
        return Object.freeze(results.sort((a, b) =>
            new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime()
        ));
    },

    /**
     * Create aggregation metadata
     */
    getAggregationMetadata(period: AggregationPeriod): {
        period: AggregationPeriod;
        timestampConvention: string;
        weekConvention: string;
    } {
        return {
            period,
            timestampConvention: period === "daily" ? "calendar_day" :
                                  period === "weekly" ? "iso_week_starting_monday" :
                                  "calendar_month",
            weekConvention: period === "weekly" ? "ISO_8601" : "N/A"
        };
    }
};
