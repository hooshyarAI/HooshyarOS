import { evaluateTrialValue } from "./TrialValueMeasurement";

describe("Trial value measurement", () => {
    it("does not claim value when no evidence of actual use exists", () => {
        const result = evaluateTrialValue({
            processedItems: 0,
            successfulExtractions: 0,
            manualEntriesAvoided: 0,
            validationIssuesDetected: 0,
            reconciliationIssuesDetected: 0,
            estimatedMinutesSaved: 0,
        });

        expect(result.evidenceComplete).toBe(true);
        expect(result.valueProven).toBe(false);
    });

    it("proves value when actual processing avoids manual entry and saves time", () => {
        const result = evaluateTrialValue({
            processedItems: 100,
            successfulExtractions: 96,
            manualEntriesAvoided: 80,
            validationIssuesDetected: 7,
            reconciliationIssuesDetected: 3,
            estimatedMinutesSaved: 240,
        });

        expect(result.evidenceComplete).toBe(true);
        expect(result.valueProven).toBe(true);
    });

    it("rejects impossible extraction evidence", () => {
        const result = evaluateTrialValue({
            processedItems: 10,
            successfulExtractions: 11,
            manualEntriesAvoided: 5,
            validationIssuesDetected: 0,
            reconciliationIssuesDetected: 0,
            estimatedMinutesSaved: 30,
        });

        expect(result.evidenceComplete).toBe(false);
        expect(result.valueProven).toBe(false);
    });
});
