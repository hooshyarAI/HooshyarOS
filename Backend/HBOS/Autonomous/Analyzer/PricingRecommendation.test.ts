import { recommendPricing } from "./PricingRecommendation";

describe("Pricing recommendation", () => {
    const proven = {
        baseMonthlyPrice: 10000000,
        provenValueMinutesSaved: 300,
        activeCapabilities: 4,
        usageScore: 80,
    };

    it("recommends a discounted annual equivalent from verified usage", () => {
        expect(recommendPricing({ ...proven, plan: "ANNUAL" })).toEqual({
            eligible: true,
            monthlyEquivalent: 8000000,
            discountRate: 0.2,
            reason: "PRICING_RECOMMENDED_FROM_VERIFIED_USAGE",
        });
    });

    it("applies a smaller quarterly commitment discount", () => {
        expect(recommendPricing({ ...proven, plan: "QUARTERLY" })).toEqual({
            eligible: true,
            monthlyEquivalent: 9000000,
            discountRate: 0.1,
            reason: "PRICING_RECOMMENDED_FROM_VERIFIED_USAGE",
        });
    });

    it("does not recommend pricing without verified usage evidence", () => {
        const result = recommendPricing({ ...proven, usageScore: 0, plan: "MONTHLY" });
        expect(result.eligible).toBe(false);
        expect(result.reason).toBe("INSUFFICIENT_PRICING_EVIDENCE");
    });
});
