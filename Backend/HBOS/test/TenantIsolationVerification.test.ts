import { CommercialIdentityService } from "../Product/CommercialIdentityService";

describe("Production readiness: tenant isolation", () => {
    it("rejects cross-tenant authorization while preserving each tenant identity", () => {
        const identity = new CommercialIdentityService();
        identity.initialize();

        const tenantA = identity.createSession("owner-a", "tenant-a");
        const tenantB = identity.createSession("owner-b", "tenant-b");

        expect(tenantA.tenantId).not.toBe(tenantB.tenantId);
        expect(identity.authorize(tenantA.token, "tenant-a", "READ_DASHBOARD").tenantId).toBe(tenantA.tenantId);
        expect(() => identity.authorize(tenantA.token, "tenant-b", "READ_DASHBOARD")).toThrow("AUTHORIZATION_DENIED");
        expect(identity.authorize(tenantB.token, "tenant-b", "READ_DASHBOARD").tenantId).toBe(tenantB.tenantId);
    });
});
