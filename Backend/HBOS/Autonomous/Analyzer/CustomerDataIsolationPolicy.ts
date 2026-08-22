export interface CustomerDataIsolationPolicy {
    denyCrossTenantAccess: true;
    denyOperatorPlaintextAccess: true;
    denyOwnerPlaintextAccess: true;
    encryptDataAtRest: true;
    encryptDataInTransit: true;
    isolateCustomerKeys: true;
    protectCustomerModels: true;
    protectCustomerFormulas: true;
    protectCustomerMethods: true;
    auditAllPrivilegedAccess: true;
    noCustomerDataForCrossTenantLearning: true;
    requireExplicitDecryptionAuthorization: true;
}

export const CUSTOMER_DATA_ISOLATION_POLICY: CustomerDataIsolationPolicy = {
    denyCrossTenantAccess: true,
    denyOperatorPlaintextAccess: true,
    denyOwnerPlaintextAccess: true,
    encryptDataAtRest: true,
    encryptDataInTransit: true,
    isolateCustomerKeys: true,
    protectCustomerModels: true,
    protectCustomerFormulas: true,
    protectCustomerMethods: true,
    auditAllPrivilegedAccess: true,
    noCustomerDataForCrossTenantLearning: true,
    requireExplicitDecryptionAuthorization: true,
};
