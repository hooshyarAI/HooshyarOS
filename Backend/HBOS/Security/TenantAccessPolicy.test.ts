import { TenantAccessPolicy } from "./TenantAccessPolicy";

describe("TenantAccessPolicy", () => {
    const policy = new TenantAccessPolicy();

    it("allows access only to the identity tenant", () => {
        expect(policy.canAccess({ userId: "u1", tenantId: "tenant-a" }, "tenant-a")).toBe(true);
        expect(policy.canAccess({ userId: "u1", tenantId: "tenant-a" }, "tenant-b")).toBe(false);
    });

    it("denies missing tenant context", () => {
        expect(policy.canAccess({ userId: "u1", tenantId: "" }, "tenant-a")).toBe(false);
        expect(policy.canAccess({ userId: "", tenantId: "tenant-a" }, "tenant-a")).toBe(false);
        expect(() => policy.assertSameTenant({ userId: "u1", tenantId: "tenant-a" }, "tenant-b")).toThrow("Tenant access denied");
    });
});
