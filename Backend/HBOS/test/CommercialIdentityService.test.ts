import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { CommercialIdentityService } from "../Product/CommercialIdentityService";

const PASSWORD = "Strong-Demo-Password-2026!";

describe("CommercialIdentityService", () => {
    let persistence: SQLitePersistenceStore;
    let identity: CommercialIdentityService;

    beforeEach(() => {
        persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
        identity = new CommercialIdentityService(persistence);
        identity.initialize();
    });

    afterEach(() => persistence.close());

    test("registers an organization owner, authenticates and revokes its session", async () => {
        const owner = await identity.registerOrganizationOwner("مدیرعامل", "سازمان تست", PASSWORD);
        expect(owner.active).toBe(true);
        expect(owner.role).toBe("OWNER");
        expect(owner.tenantId).toMatch(/^tenant:/);
        expect(owner.expiresAt).toBeTruthy();

        const authorized = await identity.authorize(owner.token, "سازمان تست", "INGEST_DATA");
        expect(authorized.tenantId).toBe(owner.tenantId);
        await expect(identity.authorize(owner.token, "سازمان دیگر", "INGEST_DATA")).rejects.toThrow("AUTHORIZATION_DENIED");

        const loggedIn = await identity.login("مدیرعامل", "سازمان تست", PASSWORD);
        expect(loggedIn.tenantId).toBe(owner.tenantId);
        expect(loggedIn.token).not.toBe(owner.token);

        expect(await identity.logout(owner.token)).toBe(true);
        expect(identity.getSession(owner.token)).toBeNull();
        await expect(identity.authorize(owner.token, "سازمان تست", "READ_DASHBOARD")).rejects.toThrow("AUTHORIZATION_DENIED");

        const auditTypes = (await identity.auditTrail()).map(event => event.type);
        expect(auditTypes).toContain("ACCOUNT_CREATED");
        expect(auditTypes).toContain("LOGIN_SUCCEEDED");
        expect(auditTypes).toContain("AUTHORIZATION_ALLOWED");
        expect(auditTypes).toContain("AUTHORIZATION_DENIED");
        expect(auditTypes).toContain("SESSION_REVOKED");
    });

    test("stores salted password hashes and rejects incorrect credentials", async () => {
        await identity.registerOrganizationOwner("owner", "Secure Org", PASSWORD);
        const stored = await persistence.read({ tenantId: "__hooshyaros_platform_identity__" }, "commercial-identity-registry:v1");
        const registry = stored?.value as {
            users: Record<string, { passwordHash: string; passwordSalt: string }>;
        };
        const [user] = Object.values(registry.users);
        expect(user.passwordHash).not.toContain(PASSWORD);
        expect(user.passwordHash).toMatch(/^[a-f0-9]{128}$/);
        expect(user.passwordSalt).toMatch(/^[a-f0-9]{32}$/);
        await expect(identity.login("owner", "Secure Org", "Wrong-Password-2026!")).rejects.toThrow("AUTHENTICATION_FAILED");
        await expect(identity.login("missing", "Secure Org", PASSWORD)).rejects.toThrow("AUTHENTICATION_FAILED");
    });

    test("refuses duplicate organizations and weak passwords", async () => {
        await identity.registerOrganizationOwner("owner", "Reserved Org", PASSWORD);
        await expect(identity.registerOrganizationOwner("other", "Reserved Org", PASSWORD)).rejects.toThrow("ORGANIZATION_ALREADY_EXISTS");
        await expect(identity.registerOrganizationOwner("weak", "Another Org", "short")).rejects.toThrow("PASSWORD_POLICY_INVALID");
    });

    test("supports single-use, expiring invitations and enforces viewer permissions", async () => {
        const owner = await identity.registerOrganizationOwner("owner", "Invite Org", PASSWORD);
        const invitation = await identity.createInvitation(owner.token, "VIEWER");
        expect(invitation.code.length).toBeGreaterThan(20);
        const viewer = await identity.joinOrganization("viewer", PASSWORD, invitation.code);

        expect(viewer.role).toBe("VIEWER");
        expect(viewer.tenantId).toBe(owner.tenantId);
        await identity.authorize(viewer.token, "Invite Org", "READ_DASHBOARD");
        await expect(identity.authorize(viewer.token, "Invite Org", "INGEST_DATA")).rejects.toThrow("AUTHORIZATION_DENIED");
        await expect(identity.joinOrganization("another-viewer", PASSWORD, invitation.code)).rejects.toThrow("INVITATION_INVALID");
    });

    test("retains account-to-tenant mapping when a new service instance logs in", async () => {
        const owner = await identity.registerOrganizationOwner("durable-owner", "Durable Org", PASSWORD);
        const recreated = new CommercialIdentityService(persistence);
        recreated.initialize();
        const session = await recreated.login("durable-owner", "Durable Org", PASSWORD);
        expect(session.tenantId).toBe(owner.tenantId);
        expect(session.organization).toBe(owner.organization);
    });
});
