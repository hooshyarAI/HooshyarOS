import { CUSTOMER_DATA_ISOLATION_POLICY } from "./CustomerDataIsolationPolicy";

describe("Customer data isolation policy", () => {
    it("denies cross-tenant and privileged plaintext access", () => {
        expect(CUSTOMER_DATA_ISOLATION_POLICY.denyCrossTenantAccess).toBe(true);
        expect(CUSTOMER_DATA_ISOLATION_POLICY.denyOperatorPlaintextAccess).toBe(true);
        expect(CUSTOMER_DATA_ISOLATION_POLICY.denyOwnerPlaintextAccess).toBe(true);
    });

    it("requires encryption and customer-specific key isolation", () => {
        expect(CUSTOMER_DATA_ISOLATION_POLICY.encryptDataAtRest).toBe(true);
        expect(CUSTOMER_DATA_ISOLATION_POLICY.encryptDataInTransit).toBe(true);
        expect(CUSTOMER_DATA_ISOLATION_POLICY.isolateCustomerKeys).toBe(true);
    });

    it("protects customer-specific intelligence and forbids cross-tenant learning", () => {
        expect(CUSTOMER_DATA_ISOLATION_POLICY.protectCustomerModels).toBe(true);
        expect(CUSTOMER_DATA_ISOLATION_POLICY.protectCustomerFormulas).toBe(true);
        expect(CUSTOMER_DATA_ISOLATION_POLICY.protectCustomerMethods).toBe(true);
        expect(CUSTOMER_DATA_ISOLATION_POLICY.noCustomerDataForCrossTenantLearning).toBe(true);
    });

    it("requires audited privileged access and explicit decryption authorization", () => {
        expect(CUSTOMER_DATA_ISOLATION_POLICY.auditAllPrivilegedAccess).toBe(true);
        expect(CUSTOMER_DATA_ISOLATION_POLICY.requireExplicitDecryptionAuthorization).toBe(true);
    });
});
