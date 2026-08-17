import { CustomerValueEvidenceAggregation } from "./CustomerValueEvidenceAggregation";

export interface CustomerValueReportInput {
    customerId: string;
    trialDays: number;
    evidence: CustomerValueEvidenceAggregation;
}

export interface CustomerValueReport {
    customerId: string;
    trialDays: number;
    minutesSaved: number;
    manualEntriesAvoided: number;
    errorsAvoided: number;
    evidenceScore: number;
    valueProven: boolean;
    customerOwnedEvidenceOnly: true;
}

export function buildCustomerValueReport(
    input: CustomerValueReportInput,
): CustomerValueReport | null {
    if (!input.customerId || input.trialDays <= 0) return null;

    return {
        customerId: input.customerId,
        trialDays: input.trialDays,
        minutesSaved: input.evidence.minutesSaved,
        manualEntriesAvoided: input.evidence.manualEntriesAvoided,
        errorsAvoided: input.evidence.errorsAvoided,
        evidenceScore: input.evidence.evidenceScore,
        valueProven: input.evidence.valueProven,
        customerOwnedEvidenceOnly: true,
    };
}
