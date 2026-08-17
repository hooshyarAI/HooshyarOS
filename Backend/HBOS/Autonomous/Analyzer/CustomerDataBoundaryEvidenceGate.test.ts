import { evaluateCustomerDataBoundaryEvidence } from "./CustomerDataBoundaryEvidenceGate";

const complete = {
    customerScopedStorageVerified: true,
    customerScopedRetrievalVerified: true,
    crossCustomerModelAccessBlocked: true,
    crossCustomerMethodAccessBlocked: true,
    operatorAccessRestricted: true,
};

describe("Customer data boundary evidence gate", () => {
    it("passes complete isolation evidence", () => {
        expect(evaluateCustomerDataBoundaryEvidence(complete)).toEqual({ verified: true, blockers: [] });
    });

    it("blocks cross-customer model access", () => {
        const result = evaluateCustomerDataBoundaryEvidence({ ...complete, crossCustomerModelAccessBlocked: false });
        expect(result.blockers).toContain("CROSS_CUSTOMER_MODEL_ACCESS_NOT_BLOCKED");
    });

    it("blocks unrestricted operator access", () => {
        const result = evaluateCustomerDataBoundaryEvidence({ ...complete, operatorAccessRestricted: false });
        expect(result.blockers).toContain("OPERATOR_ACCESS_NOT_RESTRICTED");
    });
});
