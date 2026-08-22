import { recommendRenewal } from "./CustomerRenewalRecommendation";

describe("Customer renewal recommendation", () => {
    const healthy = {
        health: "HEALTHY" as const,
        valueProven: true,
        usageTrendPositive: true,
        subscriptionActive: true,
        securityIsolationVerified: true,
        productReadinessVerified: true,
    };

    it("recommends renewal only when sustained value and positive usage are evidenced", () => {
        expect(recommendRenewal(healthy)).toEqual({
            recommendation: "RECOMMEND_RENEWAL",
            reason: "SUSTAINED_VALUE_AND_POSITIVE_USAGE",
        });
    });

    it("routes an at-risk customer to retention intervention", () => {
        const result = recommendRenewal({ ...healthy, health: "AT_RISK" });
        expect(result.recommendation).toBe("RETENTION_INTERVENTION");
    });

    it("fails closed when security readiness is not verified", () => {
        const result = recommendRenewal({ ...healthy, securityIsolationVerified: false });
        expect(result).toEqual({
            recommendation: "INSUFFICIENT_EVIDENCE",
            reason: "READINESS_NOT_VERIFIED",
        });
    });
});
