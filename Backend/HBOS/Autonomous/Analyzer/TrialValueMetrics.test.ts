import { TrialValueMetricsCalculator } from "./TrialValueMetrics";

describe("TrialValueMetricsCalculator", () => {
    it("reports measured value when real usage metrics exist", () => {
        const result = new TrialValueMetricsCalculator().calculate({
            documentsProcessed: 10,
            recordsExtracted: 120,
            manualEntriesAvoided: 80,
            validationErrorsDetected: 4,
            hoursSaved: 6.5,
            insightsGenerated: 12,
            decisionsSupported: 3,
        });

        expect(result.hasMeasuredValue).toBe(true);
        expect(result.metrics.manualEntriesAvoided).toBe(80);
    });

    it("does not claim value when no usage has been measured", () => {
        const result = new TrialValueMetricsCalculator().calculate({
            documentsProcessed: 0,
            recordsExtracted: 0,
            manualEntriesAvoided: 0,
            validationErrorsDetected: 0,
            hoursSaved: 0,
            insightsGenerated: 0,
            decisionsSupported: 0,
        });

        expect(result.hasMeasuredValue).toBe(false);
    });

    it("rejects invalid metrics instead of producing a false value report", () => {
        expect(() =>
            new TrialValueMetricsCalculator().calculate({
                documentsProcessed: -1,
                recordsExtracted: 0,
                manualEntriesAvoided: 0,
                validationErrorsDetected: 0,
                hoursSaved: 0,
                insightsGenerated: 0,
                decisionsSupported: 0,
            }),
        ).toThrow("Trial value metrics must be finite non-negative numbers");
    });
});
