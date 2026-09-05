import { OrganizationalExecutionCoordinator } from "../Product/OrganizationalExecutionCoordinator";

describe("OrganizationalExecutionCoordinator", () => {
    it("exposes the canonical product boundary", () => {
        const service = new OrganizationalExecutionCoordinator();
        expect(service.capabilityId).toBe("product.organizational-execution");
        expect(service.targetEngine).toBe("Organizational Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new OrganizationalExecutionCoordinator().execute("continue").status).toBe("READY");
        expect(new OrganizationalExecutionCoordinator().execute(" ").status).toBe("BLOCKED");
    });
});
