import { verifyCustomerIsolation } from "./CustomerIsolationVerification";

describe("Customer isolation verification gate", () => {
    const verifiedInput = {
        policyDefined: true,
        runtimeIsolationVerified: true,
        encryptionBoundaryVerified: true,
        storageEncryptionVerified: true,
        keyIsolationVerified: true,
        crossTenantNegativeTestsPassed: true,
        privilegedAccessNegativeTestsPassed: true,
    };

    it("verifies isolation only when every security evidence gate passes", () => {
        expect(verifyCustomerIsolation(verifiedInput).verified).toBe(true);
    });

    it("fails closed when storage encryption is not verified", () => {
        expect(
            verifyCustomerIsolation({
                ...verifiedInput,
                storageEncryptionVerified: false,
            }).verified,
        ).toBe(false);
    });

    it("fails closed when cross-tenant negative tests are not proven", () => {
        expect(
            verifyCustomerIsolation({
                ...verifiedInput,
                crossTenantNegativeTestsPassed: false,
            }).verified,
        ).toBe(false);
    });
});
