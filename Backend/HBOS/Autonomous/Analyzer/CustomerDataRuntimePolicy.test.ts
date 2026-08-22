import { evaluateCustomerDataAccess } from "./CustomerDataRuntimePolicy";

describe("Customer data runtime isolation", () => {
    const base = {
        requesterTenantId: "tenant-a",
        resourceTenantId: "tenant-a",
        requesterIsOwner: false,
        requesterIsOperator: false,
        hasExplicitDecryptionAuthorization: true,
    };

    it("allows access only for the same tenant with explicit decryption authorization", () => {
        expect(evaluateCustomerDataAccess(base)).toBe("ALLOW");
    });

    it("denies cross-tenant access", () => {
        expect(
            evaluateCustomerDataAccess({ ...base, resourceTenantId: "tenant-b" }),
        ).toBe("DENY");
    });

    it("denies owner plaintext access", () => {
        expect(
            evaluateCustomerDataAccess({ ...base, requesterIsOwner: true }),
        ).toBe("DENY");
    });

    it("denies operator plaintext access", () => {
        expect(
            evaluateCustomerDataAccess({ ...base, requesterIsOperator: true }),
        ).toBe("DENY");
    });

    it("denies decryption without explicit authorization", () => {
        expect(
            evaluateCustomerDataAccess({ ...base, hasExplicitDecryptionAuthorization: false }),
        ).toBe("DENY");
    });
});
