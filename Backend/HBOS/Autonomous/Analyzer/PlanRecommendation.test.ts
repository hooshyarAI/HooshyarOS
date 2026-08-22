import { recommendPlan } from "./PlanRecommendation";

describe("Plan recommendation", () => {
    const proven = {
        valueProven: true,
        securityIsolationVerified: true,
        productReadinessVerified: true,
        estimatedMinutesSaved: 240,
        activeCapabilities: 3,
    };

    it("recommends the requested duration only after value is proven", () => {
        expect(recommendPlan({ ...proven, requestedPlan: "QUARTERLY" })).toEqual({
            eligible: true,
            recommendedPlan: "QUARTERLY",
            reason: "PLAN_RECOMMENDED_FROM_PROVEN_VALUE",
        });
    });

    it("does not recommend a plan without usage evidence", () => {
        const result = recommendPlan({
            ...proven,
            estimatedMinutesSaved: 0,
            requestedPlan: "MONTHLY",
        });

        expect(result.eligible).toBe(false);
        expect(result.reason).toBe("INSUFFICIENT_USAGE_EVIDENCE");
    });

    it("never recommends a plan when customer isolation is unverified", () => {
        const result = recommendPlan({
            ...proven,
            securityIsolationVerified: false,
            requestedPlan: "ANNUAL",
        });

        expect(result.eligible).toBe(false);
        expect(result.reason).toBe("SECURITY_ISOLATION_NOT_VERIFIED");
    });
});
