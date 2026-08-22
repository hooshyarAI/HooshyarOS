export type CommercialPlan = "MONTHLY" | "QUARTERLY" | "ANNUAL";

export interface CommercialOfferInput {
    securityIsolationVerified: boolean;
    productReadinessVerified: boolean;
    valueProven: boolean;
    requestedPlan: CommercialPlan;
}

export interface CommercialOfferDecision {
    allowed: boolean;
    plan: CommercialPlan;
    reason: string;
}

export function evaluateCommercialOffer(
    input: CommercialOfferInput,
): CommercialOfferDecision {
    if (!input.securityIsolationVerified) {
        return { allowed: false, plan: input.requestedPlan, reason: "SECURITY_ISOLATION_NOT_VERIFIED" };
    }

    if (!input.productReadinessVerified) {
        return { allowed: false, plan: input.requestedPlan, reason: "PRODUCT_READINESS_NOT_VERIFIED" };
    }

    if (!input.valueProven) {
        return { allowed: false, plan: input.requestedPlan, reason: "CUSTOMER_VALUE_NOT_PROVEN" };
    }

    return { allowed: true, plan: input.requestedPlan, reason: "COMMERCIAL_OFFER_ALLOWED" };
}
