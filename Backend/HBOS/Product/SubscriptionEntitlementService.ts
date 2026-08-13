export type CommercialPlanId =
    | "starter"
    | "growth"
    | "professional"
    | "enterprise"
    | "corporate";

export type BillingPeriod = "monthly" | "quarterly" | "annual";

export type OrganizationCategory =
    | "commercial"
    | "school"
    | "university"
    | "public-healthcare"
    | "public-hospital"
    | "charity"
    | "civil-society-nonprofit"
    | "public-benefit-nonprofit";

export interface CommercialPlan {
    id: CommercialPlanId;
    audience: string;
    billingPeriods: BillingPeriod[];
    variableUsageBilling: false;
    fullTrialDays: 30;
    pricingSource: "managed-commercial-price-catalog";
}

export interface ProductEntitlement {
    status: "FREE" | "TRIAL" | "PAID" | "BLOCKED";
    planId?: CommercialPlanId;
    perpetual: boolean;
    reason: string;
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
    readonly perpetualNonprofitAccess = true as const;

    private readonly plans: Record<CommercialPlanId, CommercialPlan> = {
        starter: { id: "starter", audience: "micro and small businesses", billingPeriods: ["monthly", "quarterly", "annual"], variableUsageBilling: false, fullTrialDays: 30, pricingSource: "managed-commercial-price-catalog" },
        growth: { id: "growth", audience: "growing small and lower-mid-market companies", billingPeriods: ["monthly", "quarterly", "annual"], variableUsageBilling: false, fullTrialDays: 30, pricingSource: "managed-commercial-price-catalog" },
        professional: { id: "professional", audience: "mid-market companies", billingPeriods: ["monthly", "quarterly", "annual"], variableUsageBilling: false, fullTrialDays: 30, pricingSource: "managed-commercial-price-catalog" },
        enterprise: { id: "enterprise", audience: "large and multi-branch organizations", billingPeriods: ["monthly", "quarterly", "annual"], variableUsageBilling: false, fullTrialDays: 30, pricingSource: "managed-commercial-price-catalog" },
        corporate: { id: "corporate", audience: "large groups and holding companies", billingPeriods: ["monthly", "quarterly", "annual"], variableUsageBilling: false, fullTrialDays: 30, pricingSource: "managed-commercial-price-catalog" },
    };

    initialize(): { status: "READY" } { return { status: "READY" }; }
    getPlan(planId: CommercialPlanId): CommercialPlan { return this.plans[planId]; }
    listPlans(): CommercialPlan[] { return Object.values(this.plans); }

    resolveEntitlement(input: { organizationCategory: OrganizationCategory; planId?: CommercialPlanId; trialActive?: boolean }): ProductEntitlement {
        const perpetualFreeCategories: OrganizationCategory[] = [
            "school",
            "university",
            "public-healthcare",
            "public-hospital",
            "charity",
            "civil-society-nonprofit",
            "public-benefit-nonprofit",
        ];

        if (perpetualFreeCategories.includes(input.organizationCategory)) {
            return { status: "FREE", perpetual: true, reason: "eligible educational, public-healthcare, charitable or nonprofit public-benefit organization" };
        }
        if (input.trialActive) return { status: "TRIAL", planId: input.planId ?? "starter", perpetual: false, reason: "30-day full product trial" };
        if (input.planId) return { status: "PAID", planId: input.planId, perpetual: false, reason: "fixed-tier subscription" };
        return { status: "BLOCKED", perpetual: false, reason: "no active trial or subscription plan" };
    }

    authorize(input: string): ProductEvidenceResult {
        const normalized = input?.trim() ?? "";
        if (!normalized) return { status: "BLOCKED", evidence: [] };
        const evidence = input.split(";").map(item => item.trim()).filter(Boolean);
        return { status: evidence.length > 0 ? "READY" : "BLOCKED", evidence };
    }
}
