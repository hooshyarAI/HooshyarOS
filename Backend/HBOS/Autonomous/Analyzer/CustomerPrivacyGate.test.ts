import { customerAccessAllowed } from "./CustomerPrivacyGate";
describe("Customer privacy gate", () => {
    it("denies access for an unauthorized or cross-tenant request", () => {
        expect(customerAccessAllowed({ authorized: true, tenantMatches: false, encrypted: true })).toBe(false);
    });
    it("requires all privacy controls", () => {
        expect(customerAccessAllowed({ authorized: true, tenantMatches: true, encrypted: true })).toBe(true);
    });
});
