export type CustomerHealth = "HEALTHY" | "AT_RISK" | "INSUFFICIENT_EVIDENCE";

export interface CustomerLifecycleHealthInput {
    subscriptionActive: boolean;
    securityIsolationVerified: boolean;
    productReadinessVerified: boolean;
    valueProven: boolean;
    usageScore: number;
    activeCapabilities: number;
}

export interface CustomerLifecycleHealthResult {
    health: CustomerHealth;
    reason: string;
}

export function evaluateCustomerLifecycleHealth(
    input: CustomerLifecycleHealthInput,
): CustomerLifecycleHealthResult {
    if (!input.securityIsolationVerified || !input.productReadinessVerified) {
        return { health: "INSUFFICIENT_EVIDENCE", reason: "READINESS_NOT_VERIFIED" };
    }

    if (!input.subscriptionActive) {
        return { health: "INSUFFICIENT_EVIDENCE", reason: "SUBSCRIPTION_NOT_ACTIVE" };
    }

    if (!input.valueProven || input.usageScore <= 0 || input.activeCapabilities <= 0) {
        return { health: "AT_RISK", reason: "VALUE_OR_USAGE_INSUFFICIENT" };
    }

    if (input.usageScore < 40 || input.activeCapabilities < 2) {
        return { health: "AT_RISK", reason: "LOW_ENGAGEMENT" };
    }

    return { health: "HEALTHY", reason: "VALUE_AND_USAGE_CONFIRMED" };
}
