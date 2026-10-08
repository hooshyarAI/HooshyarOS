import { OrganizationModelEngine } from "../Engines/OrganizationModelEngine";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";

describe("OrganizationModelEngine — Phase 13-1.2 real tenant boundary", () => {
    let persistence: SQLitePersistenceStore;
    let engine: OrganizationModelEngine;

    beforeEach(() => {
        persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
        engine = new OrganizationModelEngine(persistence);
        engine.initialize();
    });

    afterEach(() => {
        persistence.close();
    });

    it("persists an organization with a canonical tenantId", () => {
        const result = engine.createOrganization("hooshyar");
        expect(result.id).toMatch(/^org_/);
        expect(result.name).toBe("hooshyar");
        expect(result.status).toBe("ACTIVE");
        expect(result.tenantId).toBe(OrganizationModelEngine.tenantIdForOrganization("hooshyar"));
        expect(result.memberCount).toBe(0);

        const reloaded = engine.getOrganizationByName("hooshyar");
        expect(reloaded?.id).toBe(result.id);
    });

    it("blocks an empty organization name", () => {
        expect(engine.createOrganization(" ").status).toBe("BLOCKED");
        expect(engine.createOrganization("").tenantId).toBe("");
    });

    it("treats organization creation as idempotent", () => {
        const first = engine.createOrganization("Acme");
        const second = engine.createOrganization("Acme");
        expect(second.id).toBe(first.id);
        expect(engine.listOrganizations().length).toBe(1);
    });

    it("isolates distinct organizations by tenantId", () => {
        const acme = engine.createOrganization("Acme");
        const other = engine.createOrganization("Other");
        expect(acme.tenantId).not.toBe(other.tenantId);
        expect(engine.getOrganizationByTenantId(other.tenantId)?.name).toBe("Other");
        expect(engine.getOrganizationByTenantId("tenant:missing")).toBeNull();
    });

    it("tracks organization membership", () => {
        const org = engine.createOrganization("Acme");
        expect(engine.addMember(org.tenantId, "usr_1", "MANAGER")).toBe(true);
        expect(engine.addMember(org.tenantId, "usr_2", "VIEWER")).toBe(true);

        expect(engine.isMember(org.tenantId, "usr_1")).toBe(true);
        expect(engine.isMember("tenant:other", "usr_1")).toBe(false);

        const members = engine.listMembers(org.tenantId);
        expect(members.map(m => m.userId).sort()).toEqual(["usr_1", "usr_2"]);
        expect(members.find(m => m.userId === "usr_1")?.role).toBe("MANAGER");

        expect(engine.getOrganizationByTenantId(org.tenantId)?.memberCount).toBe(2);

        expect(engine.removeMember(org.tenantId, "usr_1")).toBe(true);
        expect(engine.isMember(org.tenantId, "usr_1")).toBe(false);
        expect(engine.removeMember(org.tenantId, "usr_1")).toBe(false);
    });

    it("represents health for an initialized store", () => {
        expect(engine.health()).toBe(true);
    });
});
