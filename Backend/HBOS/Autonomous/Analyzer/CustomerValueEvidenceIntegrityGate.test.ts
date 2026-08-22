import { evaluateCustomerValueEvidenceIntegrity } from "./CustomerValueEvidenceIntegrityGate";

describe("Customer value evidence integrity gate", () => {
    const valid = {
        customerId: "customer-a",
        sourceCustomerId: "customer-a",
        verified: true,
        externallySourced: true,
        containsCrossCustomerData: false,
        containsIdentifiableOtherCustomerData: false,
    };

    it("allows verified evidence scoped to the same customer", () => {
        expect(evaluateCustomerValueEvidenceIntegrity(valid)).toEqual({ allowed: true, reason: "OK" });
    });

    it("blocks cross-customer evidence", () => {
        expect(evaluateCustomerValueEvidenceIntegrity({
            ...valid, sourceCustomerId: "customer-b", containsCrossCustomerData: true,
        }).allowed).toBe(false);
    });

    it("blocks unverified evidence", () => {
        expect(evaluateCustomerValueEvidenceIntegrity({ ...valid, verified: false })).toEqual({
            allowed: false, reason: "UNVERIFIED",
        });
    });
});
