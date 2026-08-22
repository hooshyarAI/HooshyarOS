import { AuthorizationService } from "./AuthorizationService";

describe("AuthorizationService", () => {
    const service = new AuthorizationService({
        rolePermissions: {
            admin: ["financial.read", "financial.write"],
            analyst: ["financial.read"]
        }
    });

    it("allows explicitly granted permissions", () => {
        expect(service.isAllowed({ userId: "u1", roles: ["analyst"] }, "financial.read")).toBe(true);
    });

    it("denies missing permissions and unknown roles by default", () => {
        expect(service.isAllowed({ userId: "u1", roles: ["analyst"] }, "financial.write")).toBe(false);
        expect(service.isAllowed({ userId: "u1", roles: ["unknown"] }, "financial.read")).toBe(false);
        expect(service.isAllowed({ userId: "u1", roles: [] }, "financial.read")).toBe(false);
        expect(service.isAllowed({ userId: "u1", roles: ["admin"] }, "")).toBe(false);
    });

    it("throws on denied access", () => {
        expect(() => service.require({ userId: "u1", roles: ["analyst"] }, "financial.write")).toThrow("Authorization denied");
    });
});
