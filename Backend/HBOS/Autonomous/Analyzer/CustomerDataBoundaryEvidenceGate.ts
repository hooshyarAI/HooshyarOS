export interface CustomerDataBoundaryEvidence {
    customerScopedStorageVerified: boolean;
    customerScopedRetrievalVerified: boolean;
    crossCustomerModelAccessBlocked: boolean;
    crossCustomerMethodAccessBlocked: boolean;
    operatorAccessRestricted: boolean;
}

export interface CustomerDataBoundaryResult {
    verified: boolean;
    blockers: string[];
}

export function evaluateCustomerDataBoundaryEvidence(
    evidence: CustomerDataBoundaryEvidence,
): CustomerDataBoundaryResult {
    const checks: Array<[boolean, string]> = [
        [evidence.customerScopedStorageVerified, "CUSTOMER_SCOPED_STORAGE_NOT_VERIFIED"],
        [evidence.customerScopedRetrievalVerified, "CUSTOMER_SCOPED_RETRIEVAL_NOT_VERIFIED"],
        [evidence.crossCustomerModelAccessBlocked, "CROSS_CUSTOMER_MODEL_ACCESS_NOT_BLOCKED"],
        [evidence.crossCustomerMethodAccessBlocked, "CROSS_CUSTOMER_METHOD_ACCESS_NOT_BLOCKED"],
        [evidence.operatorAccessRestricted, "OPERATOR_ACCESS_NOT_RESTRICTED"],
    ];
    const blockers = checks.filter(([ok]) => !ok).map(([, reason]) => reason);
    return { verified: blockers.length === 0, blockers };
}
