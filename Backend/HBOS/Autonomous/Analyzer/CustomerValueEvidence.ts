export interface CustomerValueEvidenceInput {
    baselineMinutes: number;
    currentMinutes: number;
    baselineManualEntries: number;
    currentManualEntries: number;
    baselineErrors: number;
    currentErrors: number;
}

export interface CustomerValueEvidence {
    minutesSaved: number;
    manualEntriesAvoided: number;
    errorsAvoided: number;
    valueProven: boolean;
}

export function measureCustomerValue(
    input: CustomerValueEvidenceInput,
): CustomerValueEvidence {
    const minutesSaved = Math.max(0, input.baselineMinutes - input.currentMinutes);
    const manualEntriesAvoided = Math.max(0, input.baselineManualEntries - input.currentManualEntries);
    const errorsAvoided = Math.max(0, input.baselineErrors - input.currentErrors);

    return {
        minutesSaved,
        manualEntriesAvoided,
        errorsAvoided,
        valueProven: minutesSaved > 0 || manualEntriesAvoided > 0 || errorsAvoided > 0,
    };
}
