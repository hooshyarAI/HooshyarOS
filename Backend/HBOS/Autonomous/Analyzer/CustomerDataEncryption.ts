export interface EncryptedCustomerRecord {
    tenantId: string;
    ciphertext: string;
    keyId: string;
}

export interface CustomerKeyAccessRequest {
    requesterTenantId: string;
    resourceTenantId: string;
    keyId: string;
    hasExplicitDecryptionAuthorization: boolean;
}

export function canUseCustomerKey(
    request: CustomerKeyAccessRequest,
): boolean {
    return (
        request.requesterTenantId === request.resourceTenantId &&
        request.keyId.length > 0 &&
        request.hasExplicitDecryptionAuthorization
    );
}

export function assertEncryptedCustomerRecord(
    record: EncryptedCustomerRecord,
): void {
    if (!record.tenantId || !record.ciphertext || !record.keyId) {
        throw new Error("INVALID_ENCRYPTED_CUSTOMER_RECORD");
    }
}
