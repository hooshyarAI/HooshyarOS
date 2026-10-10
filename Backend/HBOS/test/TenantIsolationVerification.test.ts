import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { CommercialIdentityService } from "../Product/CommercialIdentityService";

describe("Production readiness: tenant isolation", () => {
    let persistence: SQLitePersistenceStore;
    let identity: CommercialIdentityService;

    beforeEach(() => {
        persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
        identity = new CommercialIdentityService(persistence);
        identity.initialize();
    });

    afterEach(() => persistence.close());

    it("rejects cross-tenant authorization while preserving stable account-to-tenant identity", async () => {
        const tenantA = await identity.registerOrganizationOwner("owner-a", "tenant-a", "Secure-Passphrase-A-2026!");
        const tenantB = await identity.registerOrganizationOwner("owner-b", "tenant-b", "Secure-Passphrase-B-2026!");

        expect(tenantA.tenantId).not.toBe(tenantB.tenantId);
        expect((await identity.authorize(tenantA.token, "tenant-a", "READ_DASHBOARD")).tenantId).toBe(tenantA.tenantId);
        await expect(identity.authorize(tenantA.token, "tenant-b", "READ_DASHBOARD")).rejects.toThrow("AUTHORIZATION_DENIED");
        expect((await identity.authorize(tenantB.token, "tenant-b", "READ_DASHBOARD")).tenantId).toBe(tenantB.tenantId);

        const reauthenticated = await identity.login("owner-a", "tenant-a", "Secure-Passphrase-A-2026!");
        expect(reauthenticated.tenantId).toBe(tenantA.tenantId);
    });
});
