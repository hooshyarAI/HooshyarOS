export interface TenantIdentity {
    userId: string;
    tenantId: string;
}

export class TenantAccessPolicy {
    assertSameTenant(identity: TenantIdentity, resourceTenantId: string): void {
        if (!identity.userId || !identity.tenantId || !resourceTenantId || identity.tenantId !== resourceTenantId) {
            throw new Error("Tenant access denied");
        }
    }

    canAccess(identity: TenantIdentity, resourceTenantId: string): boolean {
        return Boolean(identity.userId && identity.tenantId && resourceTenantId && identity.tenantId === resourceTenantId);
    }
}
