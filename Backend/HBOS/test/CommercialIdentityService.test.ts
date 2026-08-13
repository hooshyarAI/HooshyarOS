import { CommercialIdentityService } from "../Product/CommercialIdentityService";

describe("CommercialIdentityService", () => {
    test("creates, authorizes and revokes a tenant-scoped session", () => {
        const identity = new CommercialIdentityService();
        identity.initialize();
        const session = identity.createSession("مدیرعامل", "سازمان تست", "OWNER");

        expect(session.active).toBe(true);
        expect(identity.authorize(session.token, "سازمان تست", "INGEST_DATA").tenantId).toBe(session.tenantId);
        expect(() => identity.authorize(session.token, "سازمان دیگر", "INGEST_DATA")).toThrow("AUTHORIZATION_DENIED");
        expect(identity.logout(session.token)).toBe(true);
        expect(identity.getSession(session.token)).toBeNull();
        expect(() => identity.authorize(session.token, "سازمان تست", "READ_DASHBOARD")).toThrow("AUTHORIZATION_DENIED");

        const auditTypes = identity.auditTrail().map(event => event.type);
        expect(auditTypes).toContain("SESSION_CREATED");
        expect(auditTypes).toContain("AUTHORIZATION_ALLOWED");
        expect(auditTypes).toContain("AUTHORIZATION_DENIED");
        expect(auditTypes).toContain("SESSION_REVOKED");
    });

    test("enforces viewer permissions", () => {
        const identity = new CommercialIdentityService();
        identity.initialize();
        const session = identity.createSession("مشاهده‌گر", "سازمان تست", "VIEWER");
        expect(identity.authorize(session.token, "سازمان تست", "READ_DASHBOARD").role).toBe("VIEWER");
        expect(() => identity.authorize(session.token, "سازمان تست", "INGEST_DATA")).toThrow("AUTHORIZATION_DENIED");
    });
});
