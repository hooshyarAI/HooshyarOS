import { OrganizationModelEngine } from "../Engines/OrganizationModelEngine";

describe("OrganizationModelEngine", () => {
    it("creates a canonical organization", () => {
        expect(new OrganizationModelEngine().createOrganization("hooshyar")).toEqual({ name: "hooshyar", status: "READY" });
    });

    it("blocks an empty organization name", () => {
        expect(new OrganizationModelEngine().createOrganization(" ").status).toBe("BLOCKED");
    });
});
