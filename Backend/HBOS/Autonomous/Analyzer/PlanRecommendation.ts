import { CommercialPlan } from "./CommercialOfferPolicy";

export interface PlanRecommendationInput {
    valueProven: boolean;
    securityIsolationVerified: boolean;
    productReadinessVerified: boolean;
    estimatedMinutesSaved: number;
    activeCapabilities: number;
    requestedPlan: CommercialPlan;
}

export interface PlanRecommendation {
    eligible: boolean;
    recommendedPlan: CommercialPlan | null;
    reason: string;
}

export function recommendPlan(input: PlanRecommendationInput): PlanRecommendation {
    if (!input.securityIsolationVerified) {
        return { eligible: false, recommendedPlan: null, reason: "SECURITY_ISOLATION_NOT_VERIFIED" };
    }
    if (!input.productReadinessVerified) {
        return { eligible: false, recommendedPlan: null, reason: "PRODUCT_READINESS_NOT_VERIFIED" };
    }
    if (!input.valueProven) {
        return { eligible: false, recommendedPlan: null, reason: "CUSTOMER_VALUE_NOT_PROVEN" };
    }
    if (input.estimatedMinutesSaved <= 0 || input.activeCapabilities <= 0) {
        return { eligible: false, recommendedPlan: null, reason: "INSUFFICIENT_USAGE_EVIDENCE" };
    }

    return {
        eligible: true,
        recommendedPlan: input.requestedPlan,
        reason: "PLAN_RECOMMENDED_FROM_PROVEN_VALUE",
    };
}
