import { CommercialIdentityService } from "../Product/CommercialIdentityService";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { UserManagementEngine } from "../Engines/UserManagementEngine";

describe("Phase 13-1.3/13-1.4 — RBAC and session lifecycle", () => {
    let persistence: SQLitePersistenceStore;
    let identity: CommercialIdentityService;
    let users: UserManagementEngine;

    beforeEach(() => {
        persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
        users = new UserManagementEngine(persistence);
        users.initialize();
        identity = new CommercialIdentityService(persistence);
        identity.initialize();
    });

    afterEach(() => {
        persistence.close();
    });

    it("assigns OWNER to the first organization member and VIEWER to later members", () => {
        const owner = identity.registerUser("owner", "Sup3rSecret!", "Acme");
        const viewer = identity.registerUser("viewer", "Sup3rSecret!", "Acme");
        expect(owner.success).toBe(true);
        expect(owner.session!.role).toBe("OWNER");
        expect(viewer.session!.role).toBe("VIEWER");
    });

    it("enforces the role permission matrix through the canonical security layer", () => {
        const owner = identity.registerUser("owner", "Sup3rSecret!", "Acme").session!;
        const viewer = identity.registerUser("viewer", "Sup3rSecret!", "Acme").session!;

        expect(identity.hasPermission(owner.token, "Acme", "MANAGE_USERS")).toBe(true);
        expect(identity.hasPermission(owner.token, "Acme", "CREATE_DECISION")).toBe(true);
        expect(identity.hasPermission(viewer.token, "Acme", "READ_DASHBOARD")).toBe(true);
        expect(identity.hasPermission(viewer.token, "Acme", "INGEST_DATA")).toBe(false);
        expect(identity.hasPermission(viewer.token, "Acme", "CREATE_DECISION")).toBe(false);
        expect(() => identity.authorize(viewer.token, "Acme", "MANAGE_USERS")).toThrow("AUTHORIZATION_DENIED");

        const viewerId = identity.getSession(viewer.token)!.userId;
        expect(users.updateUserRole(viewerId, "MANAGER")).toBe(true);
        const elevated = identity.login("viewer", "Sup3rSecret!", "Acme").session!;
        expect(identity.hasPermission(elevated.token, "Acme", "CREATE_DECISION")).toBe(true);
        expect(identity.hasPermission(elevated.token, "Acme", "MANAGE_USERS")).toBe(false);
    });

    it("denies cross-tenant authorization via the tenant isolation guard", () => {
        const acme = identity.registerUser("acme-owner", "Sup3rSecret!", "Acme").session!;
        identity.registerUser("other-owner", "Sup3rSecret!", "Other");
        expect(() => identity.authorize(acme.token, "Other", "READ_DASHBOARD")).toThrow("AUTHORIZATION_DENIED");
        expect(identity.hasPermission(acme.token, "Other", "READ_DASHBOARD")).toBe(false);
    });

    it("records authentication and authorization audit events", () => {
        const session = identity.registerUser("owner", "Sup3rSecret!", "Acme").session!;
        expect(identity.login("owner", "wrong-password", "Acme").success).toBe(false);
        expect(identity.login("owner", "Sup3rSecret!", "Acme").success).toBe(true);
        identity.hasPermission(session.token, "Acme", "READ_DASHBOARD");

        const types = identity.auditTrail().map(e => e.type);
        expect(types).toContain("SESSION_CREATED");
        expect(types).toContain("AUTHENTICATION_FAILED");
        expect(types).toContain("AUTHENTICATION_SUCCEEDED");
        expect(types).toContain("AUTHORIZATION_ALLOWED");
    });

    it("supports refresh, logout and expiry for persistent sessions", () => {
        let current = 2_000_000;
        identity.setNowProvider(() => current);
        const session = identity.registerUser("owner", "Sup3rSecret!", "Acme").session!;

        current += 1000;
        const refreshed = identity.refreshSession(session.token);
        expect(refreshed).not.toBeNull();
        expect(Date.parse(refreshed!.expiresAt)).toBeGreaterThan(Date.parse(session.expiresAt));

        expect(identity.logout(session.token)).toBe(true);
        expect(identity.getSession(session.token)).toBeNull();
        expect(identity.refreshSession(session.token)).toBeNull();

        const fresh = identity.login("owner", "Sup3rSecret!", "Acme").session!;
        current += 60 * 60 * 1000 + 1;
        expect(identity.getSession(fresh.token)).toBeNull();
        expect(identity.auditTrail().map(e => e.type)).toContain("SESSION_EXPIRED");
    });

    it("rejects a passwordless bootstrap account until a password is set", () => {
        const bootstrap = identity.createSession("legacy", "Acme", "OWNER");
        expect(identity.login("legacy", "anything", "Acme").success).toBe(false);

        const bootstrapUserId = identity.getSession(bootstrap.token)!.userId;
        expect(users.setPassword(bootstrapUserId, "Sup3rSecret!")).toBe(true);
        expect(identity.login("legacy", "Sup3rSecret!", "Acme").success).toBe(true);
    });
});
