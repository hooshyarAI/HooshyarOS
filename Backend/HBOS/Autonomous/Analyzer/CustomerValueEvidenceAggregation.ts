import { CustomerValueEvidence } from "./CustomerValueEvidence";

export interface CustomerValueEvidenceAggregation {
    minutesSaved: number;
    manualEntriesAvoided: number;
    errorsAvoided: number;
    evidenceScore: number;
    valueProven: boolean;
}

export function aggregateCustomerValueEvidence(
    evidence: CustomerValueEvidence,
): CustomerValueEvidenceAggregation {
    const positiveSignals = [
        evidence.minutesSaved > 0,
        evidence.manualEntriesAvoided > 0,
        evidence.errorsAvoided > 0,
    ].filter(Boolean).length;

    const evidenceScore = positiveSignals / 3;

    return {
        ...evidence,
        evidenceScore,
        valueProven: evidence.valueProven && evidenceScore > 0,
    };
}
