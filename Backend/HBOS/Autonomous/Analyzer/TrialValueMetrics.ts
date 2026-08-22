export interface TrialValueMetrics {
    documentsProcessed: number;
    recordsExtracted: number;
    manualEntriesAvoided: number;
    validationErrorsDetected: number;
    hoursSaved: number;
    insightsGenerated: number;
    decisionsSupported: number;
}

export interface TrialValueReport {
    metrics: TrialValueMetrics;
    hasMeasuredValue: boolean;
}

export class TrialValueMetricsCalculator {
    calculate(metrics: TrialValueMetrics): TrialValueReport {
        const values = Object.values(metrics);
        const valid = values.every((value) => Number.isFinite(value) && value >= 0);

        if (!valid) {
            throw new Error("Trial value metrics must be finite non-negative numbers");
        }

        const hasMeasuredValue =
            metrics.documentsProcessed > 0 ||
            metrics.recordsExtracted > 0 ||
            metrics.manualEntriesAvoided > 0 ||
            metrics.validationErrorsDetected > 0 ||
            metrics.hoursSaved > 0 ||
            metrics.insightsGenerated > 0 ||
            metrics.decisionsSupported > 0;

        return { metrics, hasMeasuredValue };
    }
}
