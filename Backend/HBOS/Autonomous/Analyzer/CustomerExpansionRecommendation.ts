import { CustomerHealth } from "./CustomerLifecycleHealth";

export type ExpansionRecommendation = "RECOMMEND_EXPANSION" | "NO_EXPANSION" | "INSUFFICIENT_EVIDENCE";

export interface CustomerExpansionInput {
    health: CustomerHealth;
    valueProven: boolean;
    securityIsolationVerified: boolean;
    productReadinessVerified: boolean;
    unusedCapabilityAvailable: boolean;
    expectedValuePositive: boolean;
}

export interface CustomerExpansionResult {
    recommendation: ExpansionRecommendation;
    reason: string;
}

export function recommendExpansion(
    input: CustomerExpansionInput,
): CustomerExpansionResult {
    if (!input.securityIsolationVerified || !input.productReadinessVerified) {
        return { recommendation: "INSUFFICIENT_EVIDENCE", reason: "READINESS_NOT_VERIFIED" };
    }
    if (input.health !== "HEALTHY" || !input.valueProven) {
        return { recommendation: "NO_EXPANSION", reason: "CUSTOMER_VALUE_OR_HEALTH_NOT_ESTABLISHED" };
    }
    if (!input.unusedCapabilityAvailable) {
        return { recommendation: "NO_EXPANSION", reason: "NO_UNUSED_CAPABILITY_IDENTIFIED" };
    }
    if (!input.expectedValuePositive) {
        return { recommendation: "NO_EXPANSION", reason: "EXPECTED_VALUE_NOT_POSITIVE" };
    }
    return { recommendation: "RECOMMEND_EXPANSION", reason: "CUSTOMER_OWN_EVIDENCE_SUPPORTS_EXPANSION" };
}
