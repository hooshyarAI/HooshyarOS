export type CustomerDataAccessDecision = "ALLOW" | "DENY";

export interface CustomerDataAccessRequest {
    requesterTenantId: string;
    resourceTenantId: string;
    requesterIsOwner: boolean;
    requesterIsOperator: boolean;
    hasExplicitDecryptionAuthorization: boolean;
}

export function evaluateCustomerDataAccess(
    request: CustomerDataAccessRequest,
): CustomerDataAccessDecision {
    if (request.requesterTenantId !== request.resourceTenantId) {
        return "DENY";
    }

    if (request.requesterIsOwner || request.requesterIsOperator) {
        return "DENY";
    }

    if (!request.hasExplicitDecryptionAuthorization) {
        return "DENY";
    }

    return "ALLOW";
}
