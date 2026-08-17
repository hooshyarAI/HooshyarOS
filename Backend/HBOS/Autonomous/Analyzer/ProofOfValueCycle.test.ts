import { evaluateProofOfValueCycle } from "./ProofOfValueCycle";

describe("Proof of value cycle", () => {
    it("returns VALUE_PROVEN only when trial evidence proves measurable value", () => {
        const result = evaluateProofOfValueCycle({
            processedItems: 120,
            successfulExtractions: 114,
            manualEntriesAvoided: 90,
            validationIssuesDetected: 8,
            reconciliationIssuesDetected: 4,
            estimatedMinutesSaved: 300,
        });

        expect(result.outcome).toBe("VALUE_PROVEN");
        expect(result.report.valueProven).toBe(true);
    });

    it("keeps the commercial decision negative when value is not evidenced", () => {
        const result = evaluateProofOfValueCycle({
            processedItems: 0,
            successfulExtractions: 0,
            manualEntriesAvoided: 0,
            validationIssuesDetected: 0,
            reconciliationIssuesDetected: 0,
            estimatedMinutesSaved: 0,
        });

        expect(result.outcome).toBe("VALUE_NOT_PROVEN");
        expect(result.report.valueProven).toBe(false);
    });
});
