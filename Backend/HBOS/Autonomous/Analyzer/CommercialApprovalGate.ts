export type ApprovalLevel = "AUTHORIZED" | "UNAUTHORIZED";

export interface CommercialApprovalInput {
    offerPackageId: string;
    approvalLevel: ApprovalLevel;
    securityIsolationVerified: boolean;
    productReadinessVerified: boolean;
    valueProven: boolean;
}

export interface CommercialApprovalDecision {
    approved: boolean;
    reason: string;
}

export function evaluateCommercialApproval(
    input: CommercialApprovalInput,
): CommercialApprovalDecision {
    if (!input.offerPackageId) {
        return { approved: false, reason: "OFFER_PACKAGE_MISSING" };
    }
    if (input.approvalLevel !== "AUTHORIZED") {
        return { approved: false, reason: "APPROVAL_NOT_AUTHORIZED" };
    }
    if (!input.securityIsolationVerified) {
        return { approved: false, reason: "SECURITY_ISOLATION_NOT_VERIFIED" };
    }
    if (!input.productReadinessVerified) {
        return { approved: false, reason: "PRODUCT_READINESS_NOT_VERIFIED" };
    }
    if (!input.valueProven) {
        return { approved: false, reason: "CUSTOMER_VALUE_NOT_PROVEN" };
    }
    return { approved: true, reason: "COMMERCIAL_APPROVAL_GRANTED" };
}
