import { recommendExpansion } from "./CustomerExpansionRecommendation";

describe("Customer expansion recommendation", () => {
    const healthy = {
        health: "HEALTHY" as const,
        valueProven: true,
        securityIsolationVerified: true,
        productReadinessVerified: true,
        unusedCapabilityAvailable: true,
        expectedValuePositive: true,
    };

    it("recommends expansion only from the customer's own positive evidence", () => {
        expect(recommendExpansion(healthy)).toEqual({
            recommendation: "RECOMMEND_EXPANSION",
            reason: "CUSTOMER_OWN_EVIDENCE_SUPPORTS_EXPANSION",
        });
    });

    it("does not recommend expansion for an unhealthy customer", () => {
        const result = recommendExpansion({ ...healthy, health: "AT_RISK" });
        expect(result.recommendation).toBe("NO_EXPANSION");
    });

    it("fails closed when readiness is not verified", () => {
        const result = recommendExpansion({ ...healthy, securityIsolationVerified: false });
        expect(result).toEqual({
            recommendation: "INSUFFICIENT_EVIDENCE",
            reason: "READINESS_NOT_VERIFIED",
        });
    });
});
