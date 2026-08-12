import { OrganizationIdentityService } from "../Product/OrganizationIdentityService";

describe("OrganizationIdentityService", () => {
    const service = new OrganizationIdentityService();

    beforeEach(() => service.initialize());

    it("creates an organization and registers an active owner", () => {
        const organization = service.createOrganization("Acme Co");
        expect(organization).toEqual({ name: "Acme Co", status: "READY" });

        const owner = service.registerOwner("Acme Co", "owner-1");
        expect(owner).toEqual({
            subject: "owner-1",
            organization: "Acme Co",
            role: "OWNER",
            status: "ACTIVE"
        });
    });

    it("opens an authenticated organization-scoped session", () => {
        const owner = service.registerOwner("Acme Co", "owner-1");
        const session = service.openSession(owner);

        expect(session).toEqual({
            subject: "owner-1",
            organization: "Acme Co",
            role: "OWNER",
            status: "AUTHENTICATED",
            sessionId: "Acme Co:owner-1:OWNER"
        });
    });

    it("enforces role hierarchy for organization access", () => {
        const owner = service.registerOwner("Acme Co", "owner-1");
        const employee = {
            subject: "employee-1",
            organization: "Acme Co",
            role: "EMPLOYEE" as const,
            status: "ACTIVE" as const
        };

        expect(service.canAccess(owner, "ADMIN")).toBe(true);
        expect(service.canAccess(employee, "MANAGER")).toBe(false);
    });

    it("blocks an invalid owner registration", () => {
        expect(service.registerOwner("", "").status).toBe("BLOCKED");
    });
});
