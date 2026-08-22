export type CustomerDataAccessActor =
    | "CUSTOMER_USER"
    | "PLATFORM_OWNER"
    | "PLATFORM_OPERATOR"
    | "DEVELOPER"
    | "AI_MODEL"
    | "AUTONOMOUS_AGENT";

export interface CustomerDataPrivacyContract {
    id: "CUSTOMER_DATA_ZERO_ACCESS";
    customerDataIsConfidential: true;
    encryptionAtRestRequired: true;
    encryptionInTransitRequired: true;
    tenantIsolationRequired: true;
    leastPrivilegeRequired: true;
    ownerAccessToPlaintextDenied: true;
    operatorAccessToPlaintextDenied: true;
    developerAccessToPlaintextDenied: true;
    aiModelAccessToPlaintextDenied: true;
    autonomousAgentAccessToPlaintextDenied: true;
    accessMustBeExplicitlyAuthorized: true;
    auditAccessAttempts: true;
    noSecondaryUseWithoutCustomerAuthorization: true;
}

export const CUSTOMER_DATA_ZERO_ACCESS: CustomerDataPrivacyContract = {
    id: "CUSTOMER_DATA_ZERO_ACCESS",
    customerDataIsConfidential: true,
    encryptionAtRestRequired: true,
    encryptionInTransitRequired: true,
    tenantIsolationRequired: true,
    leastPrivilegeRequired: true,
    ownerAccessToPlaintextDenied: true,
    operatorAccessToPlaintextDenied: true,
    developerAccessToPlaintextDenied: true,
    aiModelAccessToPlaintextDenied: true,
    autonomousAgentAccessToPlaintextDenied: true,
    accessMustBeExplicitlyAuthorized: true,
    auditAccessAttempts: true,
    noSecondaryUseWithoutCustomerAuthorization: true,
};

export function isPlaintextCustomerDataAccessDenied(
    actor: CustomerDataAccessActor,
): boolean {
    return [
        "PLATFORM_OWNER",
        "PLATFORM_OPERATOR",
        "DEVELOPER",
        "AI_MODEL",
        "AUTONOMOUS_AGENT",
    ].includes(actor);
}
