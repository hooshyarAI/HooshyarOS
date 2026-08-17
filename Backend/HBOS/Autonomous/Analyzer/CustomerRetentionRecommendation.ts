import { CustomerHealth } from "./CustomerLifecycleHealth";

export type RetentionAction = "ONBOARDING" | "ENABLE_CAPABILITY" | "FIX_INTEGRATION" | "PROVE_VALUE" | "MONITOR";

export interface CustomerRetentionInput {
    health: CustomerHealth;
    lowUsage: boolean;
    missingCapability: boolean;
    integrationProblem: boolean;
    valueNotProven: boolean;
}

export interface CustomerRetentionRecommendation {
    action: RetentionAction;
    reason: string;
}

export function recommendRetentionAction(input: CustomerRetentionInput): CustomerRetentionRecommendation {
    if (input.health === "INSUFFICIENT_EVIDENCE") {
        return { action: "MONITOR", reason: "READINESS_OR_SUBSCRIPTION_EVIDENCE_INSUFFICIENT" };
    }
    if (input.integrationProblem) {
        return { action: "FIX_INTEGRATION", reason: "INTEGRATION_BLOCKS_VALUE" };
    }
    if (input.missingCapability) {
        return { action: "ENABLE_CAPABILITY", reason: "CAPABILITY_ADOPTION_GAP" };
    }
    if (input.valueNotProven) {
        return { action: "PROVE_VALUE", reason: "CUSTOMER_VALUE_NOT_PROVEN" };
    }
    if (input.lowUsage || input.health === "AT_RISK") {
        return { action: "ONBOARDING", reason: "LOW_ENGAGEMENT" };
    }
    return { action: "MONITOR", reason: "CUSTOMER_HEALTHY" };
}
