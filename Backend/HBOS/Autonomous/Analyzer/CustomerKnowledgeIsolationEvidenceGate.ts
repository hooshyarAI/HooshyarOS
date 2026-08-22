export interface CustomerKnowledgeIsolationEvidence {
    customerDataEncryptedAtRest: boolean;
    customerDataEncryptedInTransit: boolean;
    customerKnowledgeScoped: boolean;
    crossCustomerRetrievalBlocked: boolean;
    crossCustomerReuseBlocked: boolean;
    ownerAccessRequiresExplicitAuthorization: boolean;
}

export interface CustomerKnowledgeIsolationResult {
    verified: boolean;
    blockers: string[];
}

export function evaluateCustomerKnowledgeIsolationEvidence(
    evidence: CustomerKnowledgeIsolationEvidence,
): CustomerKnowledgeIsolationResult {
    const checks: Array<[boolean, string]> = [
        [evidence.customerDataEncryptedAtRest, "CUSTOMER_DATA_AT_REST_NOT_ENCRYPTED"],
        [evidence.customerDataEncryptedInTransit, "CUSTOMER_DATA_IN_TRANSIT_NOT_ENCRYPTED"],
        [evidence.customerKnowledgeScoped, "CUSTOMER_KNOWLEDGE_NOT_SCOPED"],
        [evidence.crossCustomerRetrievalBlocked, "CROSS_CUSTOMER_RETRIEVAL_NOT_BLOCKED"],
        [evidence.crossCustomerReuseBlocked, "CROSS_CUSTOMER_REUSE_NOT_BLOCKED"],
        [evidence.ownerAccessRequiresExplicitAuthorization, "OWNER_ACCESS_NOT_EXPLICITLY_AUTHORIZED"],
    ];
    const blockers = checks.filter(([ok]) => !ok).map(([, reason]) => reason);
    return { verified: blockers.length === 0, blockers };
}
