import { SubscriptionEntitlementService } from "../Product/SubscriptionEntitlementService";

describe("CommercialPricingPolicy", () => {
    it("provides a full 30-day trial and fixed subscription tiers", () => {
        const service = new SubscriptionEntitlementService();
        expect(service.trialDays).toBe(30);
        expect(service.pricingModel).toBe("FIXED_TIER_SUBSCRIPTION");
        expect(service.variableUsageBilling).toBe(false);
        expect(service.listPlans().map(plan => plan.id)).toEqual([
            "starter",
            "growth",
            "professional",
            "enterprise",
            "corporate",
        ]);
        for (const plan of service.listPlans()) {
            expect(plan.fullTrialDays).toBe(30);
            expect(plan.billingPeriods).toEqual(["monthly", "quarterly", "annual"]);
            expect(plan.variableUsageBilling).toBe(false);
        }
    });
});
