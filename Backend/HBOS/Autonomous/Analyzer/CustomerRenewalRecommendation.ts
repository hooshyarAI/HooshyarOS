import { CustomerHealth } from "./CustomerLifecycleHealth";

export type RenewalRecommendation = "RECOMMEND_RENEWAL" | "RETENTION_INTERVENTION" | "INSUFFICIENT_EVIDENCE";

export interface CustomerRenewalInput {
    health: CustomerHealth;
    valueProven: boolean;
    usageTrendPositive: boolean;
    subscriptionActive: boolean;
    securityIsolationVerified: boolean;
    productReadinessVerified: boolean;
}

export interface CustomerRenewalResult {
    recommendation: RenewalRecommendation;
    reason: string;
}

export function recommendRenewal(
    input: CustomerRenewalInput,
): CustomerRenewalResult {
    if (!input.securityIsolationVerified || !input.productReadinessVerified) {
        return { recommendation: "INSUFFICIENT_EVIDENCE", reason: "READINESS_NOT_VERIFIED" };
    }
    if (!input.subscriptionActive) {
        return { recommendation: "INSUFFICIENT_EVIDENCE", reason: "SUBSCRIPTION_NOT_ACTIVE" };
    }
    if (input.health === "AT_RISK" || !input.valueProven || !input.usageTrendPositive) {
        return { recommendation: "RETENTION_INTERVENTION", reason: "RENEWAL_VALUE_OR_HEALTH_RISK" };
    }
    if (input.health === "HEALTHY" && input.valueProven && input.usageTrendPositive) {
        return { recommendation: "RECOMMEND_RENEWAL", reason: "SUSTAINED_VALUE_AND_POSITIVE_USAGE" };
    }
    return { recommendation: "INSUFFICIENT_EVIDENCE", reason: "RENEWAL_EVIDENCE_INSUFFICIENT" };
}
