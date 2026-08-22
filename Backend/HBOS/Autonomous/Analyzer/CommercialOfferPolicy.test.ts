import { evaluateCommercialOffer } from "./CommercialOfferPolicy";

describe("Commercial offer policy", () => {
    const ready = {
        securityIsolationVerified: true,
        productReadinessVerified: true,
        valueProven: true,
    };

    it("allows an offer only when security, product readiness and value are proven", () => {
        expect(
            evaluateCommercialOffer({ ...ready, requestedPlan: "ANNUAL" }),
        ).toEqual({
            allowed: true,
            plan: "ANNUAL",
            reason: "COMMERCIAL_OFFER_ALLOWED",
        });
    });

    it("blocks offers when security isolation is not verified", () => {
        const result = evaluateCommercialOffer({
            ...ready,
            securityIsolationVerified: false,
            requestedPlan: "MONTHLY",
        });

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe("SECURITY_ISOLATION_NOT_VERIFIED");
    });

    it("blocks offers when customer value is not proven", () => {
        const result = evaluateCommercialOffer({
            ...ready,
            valueProven: false,
            requestedPlan: "QUARTERLY",
        });

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe("CUSTOMER_VALUE_NOT_PROVEN");
    });
});
