import { CommercialPlan } from "./CommercialOfferPolicy";

export interface PricingRecommendationInput {
    plan: CommercialPlan;
    baseMonthlyPrice: number;
    provenValueMinutesSaved: number;
    activeCapabilities: number;
    usageScore: number;
}

export interface PricingRecommendation {
    eligible: boolean;
    monthlyEquivalent: number | null;
    discountRate: number;
    reason: string;
}

export function recommendPricing(input: PricingRecommendationInput): PricingRecommendation {
    if (input.baseMonthlyPrice <= 0 || input.provenValueMinutesSaved <= 0 || input.activeCapabilities <= 0 || input.usageScore <= 0) {
        return { eligible: false, monthlyEquivalent: null, discountRate: 0, reason: "INSUFFICIENT_PRICING_EVIDENCE" };
    }

    const discountRate = input.plan === "ANNUAL" ? 0.20 : input.plan === "QUARTERLY" ? 0.10 : 0;
    const monthlyEquivalent = input.baseMonthlyPrice * (1 - discountRate);

    return {
        eligible: true,
        monthlyEquivalent,
        discountRate,
        reason: "PRICING_RECOMMENDED_FROM_VERIFIED_USAGE",
    };
}
