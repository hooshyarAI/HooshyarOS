import {
    assertEncryptedCustomerRecord,
    canUseCustomerKey,
} from "./CustomerDataEncryption";

describe("Customer-specific encryption boundary", () => {
    it("allows a customer key only for the same tenant with explicit authorization", () => {
        expect(
            canUseCustomerKey({
                requesterTenantId: "tenant-a",
                resourceTenantId: "tenant-a",
                keyId: "key-a",
                hasExplicitDecryptionAuthorization: true,
            }),
        ).toBe(true);
    });

    it("denies a customer key across tenants", () => {
        expect(
            canUseCustomerKey({
                requesterTenantId: "tenant-a",
                resourceTenantId: "tenant-b",
                keyId: "key-b",
                hasExplicitDecryptionAuthorization: true,
            }),
        ).toBe(false);
    });

    it("denies key use without explicit decryption authorization", () => {
        expect(
            canUseCustomerKey({
                requesterTenantId: "tenant-a",
                resourceTenantId: "tenant-a",
                keyId: "key-a",
                hasExplicitDecryptionAuthorization: false,
            }),
        ).toBe(false);
    });

    it("rejects incomplete encrypted records", () => {
        expect(() =>
            assertEncryptedCustomerRecord({
                tenantId: "tenant-a",
                ciphertext: "",
                keyId: "key-a",
            }),
        ).toThrow("INVALID_ENCRYPTED_CUSTOMER_RECORD");
    });
});
