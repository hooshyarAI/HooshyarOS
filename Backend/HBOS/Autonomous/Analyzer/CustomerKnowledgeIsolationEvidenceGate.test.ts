import { evaluateCustomerKnowledgeIsolationEvidence } from "./CustomerKnowledgeIsolationEvidenceGate";

const complete = {
    customerDataEncryptedAtRest: true,
    customerDataEncryptedInTransit: true,
    customerKnowledgeScoped: true,
    crossCustomerRetrievalBlocked: true,
    crossCustomerReuseBlocked: true,
    ownerAccessRequiresExplicitAuthorization: true,
};

describe("Customer knowledge isolation evidence gate", () => {
    it("passes complete isolation evidence", () => {
        expect(evaluateCustomerKnowledgeIsolationEvidence(complete)).toEqual({ verified: true, blockers: [] });
    });

    it("blocks cross-customer retrieval", () => {
        const result = evaluateCustomerKnowledgeIsolationEvidence({ ...complete, crossCustomerRetrievalBlocked: false });
        expect(result.blockers).toContain("CROSS_CUSTOMER_RETRIEVAL_NOT_BLOCKED");
    });

    it("requires explicit authorization even for owner access", () => {
        const result = evaluateCustomerKnowledgeIsolationEvidence({ ...complete, ownerAccessRequiresExplicitAuthorization: false });
        expect(result.blockers).toContain("OWNER_ACCESS_NOT_EXPLICITLY_AUTHORIZED");
    });
});
