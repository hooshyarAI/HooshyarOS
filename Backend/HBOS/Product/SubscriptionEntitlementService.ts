export type CommercialPlanId =
    | "starter"
    | "growth"
    | "professional"
    | "enterprise"
    | "corporate";

export type BillingPeriod = "monthly" | "quarterly" | "annual";

export interface CommercialPlan {
    id: CommercialPlanId;
    audience: string;
    billingPeriods: BillingPeriod[];
    variableUsageBilling: false;
    fullTrialDays: 30;
    pricingSource: "managed-commercial-price-catalog";
}

export interface ProductEvidenceResult {
    status: "READY" | "BLOCKED";
    evidence: string[] | number;
}

export class SubscriptionEntitlementService {
    readonly capabilityId = "product.commercial-subscription-entitlements";
    readonly targetEngine = "Governance Engine";
    readonly trialDays = 30;
    readonly pricingModel = "FIXED_TIER_SUBSCRIPTION" as const;
    readonly variableUsageBilling = false as const;

    private readonly plans: Record<CommercialPlanId, CommercialPlan> = {
        starter: {
            id: "starter",
            audience: "micro and small businesses",
            billingPeriods: ["monthly", "quarterly", "annual"],
            variableUsageBilling: false,
            fullTrialDays: 30,
            pricingSource: "managed-commercial-price-catalog",
        },
        growth: {
            id: "growth",
            audience: "growing small and lower-mid-market companies",
            billingPeriods: ["monthly", "quarterly", "annual"],
            variableUsageBilling: false,
            fullTrialDays: 30,
            pricingSource: "managed-commercial-price-catalog",
        },
        professional: {
            id: "professional",
            audience: "mid-market companies",
            billingPeriods: ["monthly", "quarterly", "annual"],
            variableUsageBilling: false,
            fullTrialDays: 30,
            pricingSource: "managed-commercial-price-catalog",
        },
        enterprise: {
            id: "enterprise",
            audience: "large and multi-branch organizations",
            billingPeriods: ["monthly", "quarterly", "annual"],
            variableUsageBilling: false,
            fullTrialDays: 30,
            pricingSource: "managed-commercial-price-catalog",
        },
        corporate: {
            id: "corporate",
            audience: "large groups and holding companies",
            billingPeriods: ["monthly", "quarterly", "annual"],
            variableUsageBilling: false,
            fullTrialDays: 30,
            pricingSource: "managed-commercial-price-catalog",
        },
    };

    initialize(): { status: "READY" } {
        return { status: "READY" };
    }

    getPlan(planId: CommercialPlanId): CommercialPlan {
        return this.plans[planId];
    }

    listPlans(): CommercialPlan[] {
        return Object.values(this.plans);
    }

    authorize(input: string): ProductEvidenceResult {
        const normalized = input?.trim() ?? "";
        if (!normalized) return { status: "BLOCKED", evidence: [] };
        const evidence = input.split(";").map(item => item.trim()).filter(Boolean);
        const complete = evidence.length > 0;
        return { status: complete ? "READY" : "BLOCKED", evidence };
    }
}
