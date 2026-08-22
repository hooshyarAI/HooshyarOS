export interface TrialValueMeasurement {
    processedItems: number;
    successfulExtractions: number;
    manualEntriesAvoided: number;
    validationIssuesDetected: number;
    reconciliationIssuesDetected: number;
    estimatedMinutesSaved: number;
}

export interface TrialValueReport {
    measurement: TrialValueMeasurement;
    evidenceComplete: boolean;
    valueProven: boolean;
}

export function evaluateTrialValue(
    measurement: TrialValueMeasurement,
): TrialValueReport {
    const evidenceComplete =
        measurement.processedItems >= 0 &&
        measurement.successfulExtractions >= 0 &&
        measurement.manualEntriesAvoided >= 0 &&
        measurement.validationIssuesDetected >= 0 &&
        measurement.reconciliationIssuesDetected >= 0 &&
        measurement.estimatedMinutesSaved >= 0 &&
        measurement.successfulExtractions <= measurement.processedItems;

    const valueProven =
        evidenceComplete &&
        measurement.processedItems > 0 &&
        measurement.manualEntriesAvoided > 0 &&
        measurement.estimatedMinutesSaved > 0;

    return {
        measurement,
        evidenceComplete,
        valueProven,
    };
}
