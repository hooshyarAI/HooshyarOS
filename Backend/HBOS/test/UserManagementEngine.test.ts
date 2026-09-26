import { UserManagementEngine, UserRole } from "../Engines/UserManagementEngine";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";

describe("UserManagementEngine — Phase 13-1.1 real identity", () => {
    let persistence: SQLitePersistenceStore;
    let engine: UserManagementEngine;

    beforeEach(() => {
        persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
        engine = new UserManagementEngine(persistence);
        engine.initialize();
    });

    afterEach(() => {
        persistence.close();
    });

    it("registers a user and persists a salted scrypt hash, never plaintext", () => {
        const result = engine.registerUser("ali", "Sup3rSecret!", "Acme Corp", "ADMIN");
        expect("error" in result).toBe(false);
        const user = result as Exclude<typeof result, { error: string }>;

        expect(user.id).toMatch(/^usr_/);
        expect(user.username).toBe("ali");
        expect(user.organization).toBe("Acme Corp");
        expect(user.role).toBe("ADMIN");
        expect(user.status).toBe("ACTIVE");
        expect(user.tenantId).toBe(UserManagementEngine.tenantIdForOrganization("Acme Corp"));

        const stored = persistence.database
            .prepare("SELECT password_hash, salt FROM users WHERE id = ?")
            .get(user.id) as { password_hash: string; salt: string };
        expect(stored.password_hash).toBeDefined();
        expect(stored.password_hash).not.toContain("Sup3rSecret!");
        expect(stored.salt).toBeDefined();
        expect(stored.password_hash.length).toBeGreaterThan(64);
    });

    it("blocks empty username, password, organization and short passwords", () => {
        expect((engine.registerUser(" ", "Sup3rSecret!", "Acme") as { error: string }).error).toBe("USERNAME_PASSWORD_ORGANIZATION_REQUIRED");
        expect((engine.registerUser("ali", "", "Acme") as { error: string }).error).toBe("USERNAME_PASSWORD_ORGANIZATION_REQUIRED");
        expect((engine.registerUser("ali", "Sup3rSecret!", " ") as { error: string }).error).toBe("USERNAME_PASSWORD_ORGANIZATION_REQUIRED");
        expect((engine.registerUser("ali", "short", "Acme") as { error: string }).error).toBe("PASSWORD_TOO_SHORT");
    });

    it("rejects duplicate username in the same tenant but allows it across tenants", () => {
        expect("error" in engine.registerUser("alice", "password123", "Acme Corp")).toBe(false);
        expect((engine.registerUser("alice", "password456", "Acme Corp") as { error: string }).error).toBe("USER_ALREADY_EXISTS");
        expect("error" in engine.registerUser("alice", "password789", "Other Corp")).toBe(false);
    });

    it("enforces tenant isolation on reads", () => {
        const acme = engine.registerUser("alice", "password123", "Acme Corp");
        const other = engine.registerUser("alice", "password123", "Other Corp");
        expect("error" in acme).toBe(false);
        expect("error" in other).toBe(false);

        const acmeTenant = UserManagementEngine.tenantIdForOrganization("Acme Corp");
        const otherTenant = UserManagementEngine.tenantIdForOrganization("Other Corp");
        expect(acmeTenant).not.toBe(otherTenant);

        expect(engine.getUserByUsername("alice", acmeTenant)?.id).toBe((acme as { id: string }).id);
        expect(engine.getUserByUsername("alice", otherTenant)?.id).toBe((other as { id: string }).id);
        expect(engine.getUserByUsername("alice", "tenant:unknown")).toBeNull();
        expect(engine.listUsers(acmeTenant).map(u => u.id)).toEqual([(acme as { id: string }).id]);
    });

    it("authenticates valid credentials and creates a durable session", () => {
        engine.registerUser("bob", "password123", "Acme Corp", "MANAGER");
        const result = engine.authenticate("bob", "password123", "Acme Corp");

        expect(result.success).toBe(true);
        expect(result.user?.username).toBe("bob");
        expect(result.session).toBeDefined();
        expect(result.session!.token.length).toBeGreaterThan(32);
        expect(engine.getSessionRecord(result.session!.token)?.userId).toBe(result.user!.id);
        expect(engine.validateSession(result.session!.token)?.role).toBe("MANAGER");
    });

    it("rejects wrong password, unknown user, wrong tenant and blocked accounts", () => {
        engine.registerUser("bob", "password123", "Acme Corp");

        expect(engine.authenticate("bob", "wrongpassword", "Acme Corp").error).toBe("INVALID_CREDENTIALS");
        expect(engine.authenticate("nobody", "password123", "Acme Corp").error).toBe("INVALID_CREDENTIALS");
        expect(engine.authenticate("bob", "password123", "Other Corp").error).toBe("INVALID_CREDENTIALS");

        const tenantId = UserManagementEngine.tenantIdForOrganization("Acme Corp");
        const user = engine.getUserByUsername("bob", tenantId)!;
        engine.blockUser(user.id);
        expect(engine.authenticate("bob", "password123", "Acme Corp").error).toBe("ACCOUNT_BLOCKED");
        engine.unblockUser(user.id);
        expect(engine.authenticate("bob", "password123", "Acme Corp").success).toBe(true);
    });

    it("expires, refreshes and invalidates sessions using the injected clock", () => {
        let current = 1_000_000;
        engine.setNowProvider(() => current);
        engine.registerUser("carol", "password123", "Acme Corp");
        const auth = engine.authenticate("carol", "password123", "Acme Corp");
        const token = auth.session!.token;

        current += engine.getSessionTtl() + 1;
        expect(engine.validateSession(token)).toBeNull();
        expect(engine.getSessionRecord(token)).toBeNull();

        const fresh = engine.authenticate("carol", "password123", "Acme Corp").session!;
        const originalExpiry = fresh.expiresAt;
        current += 1000;
        const refreshed = engine.refreshSession(fresh.token);
        expect(refreshed).not.toBeNull();
        expect(Date.parse(refreshed!.expiresAt)).toBeGreaterThan(Date.parse(originalExpiry));

        expect(engine.logout(fresh.token)).toBe(true);
        expect(engine.validateSession(fresh.token)).toBeNull();
        expect(engine.logout("missing-token")).toBe(false);
    });

    it("cleans up expired sessions in bulk", () => {
        let current = 5_000_000;
        engine.setNowProvider(() => current);
        engine.registerUser("dave", "password123", "Acme Corp");
        engine.authenticate("dave", "password123", "Acme Corp");
        engine.authenticate("dave", "password123", "Acme Corp");
        current += engine.getSessionTtl() + 1;
        expect(engine.cleanupExpiredSessions()).toBeGreaterThanOrEqual(2);
    });

    it("supports role elevation with a deny-by-default hierarchy", () => {
        const reg = engine.registerUser("erin", "password123", "Acme Corp", "VIEWER") as { id: string };
        expect(engine.hasRole(reg.id, "VIEWER")).toBe(true);
        expect(engine.hasRole(reg.id, "ANALYST")).toBe(false);
        expect(engine.updateUserRole(reg.id, "ANALYST")).toBe(true);
        expect(engine.hasRole(reg.id, "ANALYST")).toBe(true);
        expect(engine.hasRole(reg.id, "MANAGER")).toBe(false);
        expect(engine.updateUserRole(reg.id, "OWNER" as UserRole)).toBe(true);
        expect(engine.hasRole(reg.id, "OWNER" as UserRole)).toBe(true);
        expect(engine.hasRole("missing", "VIEWER")).toBe(false);
    });

    it("provisions a passwordless bootstrap user that cannot authenticate", () => {
        const bootstrap = engine.ensureBootstrapUser("owner", "Acme Corp", "OWNER") as { id: string; status: string };
        expect(bootstrap.status).toBe("PENDING_VERIFICATION");
        expect(engine.authenticate("owner", "anything", "Acme Corp").error).toBe("ACCOUNT_NOT_ACTIVE");

        expect(engine.setPassword(bootstrap.id, "Sup3rSecret!")).toBe(true);
        expect(engine.authenticate("owner", "Sup3rSecret!", "Acme Corp").success).toBe(true);
    });

    it("reports health against an initialized store", () => {
        expect(engine.health()).toBe(true);
    });
});
