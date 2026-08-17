export interface CustomerValueEvidenceEnvelope {
    customerId: string;
    sourceCustomerId: string;
    verified: boolean;
    externallySourced: boolean;
    containsCrossCustomerData: boolean;
    containsIdentifiableOtherCustomerData: boolean;
}

export interface CustomerValueEvidenceIntegrityResult {
    allowed: boolean;
    reason: "OK" | "INVALID_CUSTOMER_SCOPE" | "UNVERIFIED" | "CROSS_CUSTOMER_DATA" | "IDENTIFIABLE_OTHER_CUSTOMER_DATA";
}

export function evaluateCustomerValueEvidenceIntegrity(
    evidence: CustomerValueEvidenceEnvelope,
): CustomerValueEvidenceIntegrityResult {
    if (!evidence.customerId || evidence.customerId !== evidence.sourceCustomerId) {
        return { allowed: false, reason: "INVALID_CUSTOMER_SCOPE" };
    }
    if (!evidence.verified || !evidence.externallySourced) {
        return { allowed: false, reason: "UNVERIFIED" };
    }
    if (evidence.containsCrossCustomerData) {
        return { allowed: false, reason: "CROSS_CUSTOMER_DATA" };
    }
    if (evidence.containsIdentifiableOtherCustomerData) {
        return { allowed: false, reason: "IDENTIFIABLE_OTHER_CUSTOMER_DATA" };
    }
    return { allowed: true, reason: "OK" };
}
