import { OrganizationalExecutionCoordinator } from "../Product/OrganizationalExecutionCoordinator";

describe("OrganizationalExecutionCoordinator", () => {
    it("exposes the canonical capability identity and health", () => {
        const engine = new OrganizationalExecutionCoordinator();
        expect(engine.name).toBe("OrganizationalExecutionCoordinator");
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability()).toEqual({
            id: "repair-product.organizational-execution",
            capability: "repair commercial quality failure for product.organizational-execution: turn approved managerial decisions into governed workflows, assigned work and outcome evidence",
            targetEngine: "Organizational Intelligence Engine"
        });
    });
});
