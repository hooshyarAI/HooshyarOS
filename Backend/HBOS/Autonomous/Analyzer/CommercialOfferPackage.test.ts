import { buildCommercialOfferPackage } from "./CommercialOfferPackage";

describe("Commercial offer package", () => {
    const ready = {
        customerId: "customer-a",
        plan: "ANNUAL" as const,
        monthlyEquivalent: 8000000,
        discountRate: 0.2,
        valueProven: true,
        securityIsolationVerified: true,
        productReadinessVerified: true,
        activeCapabilities: ["financial-ingestion", "decision-support"],
    };

    it("builds an evidence-backed package that still requires approval", () => {
        expect(buildCommercialOfferPackage(ready)).toEqual({
            customerId: "customer-a",
            plan: "ANNUAL",
            monthlyEquivalent: 8000000,
            discountRate: 0.2,
            activeCapabilities: ["financial-ingestion", "decision-support"],
            evidenceBacked: true,
            approvalRequired: true,
        });
    });

    it("does not build an offer without proven value", () => {
        expect(
            buildCommercialOfferPackage({ ...ready, valueProven: false }),
        ).toBeNull();
    });

    it("does not build an offer when customer isolation is unverified", () => {
        expect(
            buildCommercialOfferPackage({ ...ready, securityIsolationVerified: false }),
        ).toBeNull();
    });
});
