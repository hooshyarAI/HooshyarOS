import { DeploymentContractEngine } from "../Engines/DeploymentContractEngine";

describe("DeploymentContractEngine", () => {
    it("validates a complete deployment contract", () => {
        const engine = new DeploymentContractEngine();
        expect(engine.health()).toBe(true);
        expect(engine.validate({
            target: "production",
            artifact: "dist/hooshyaros.tar.gz",
            healthCheck: "/health",
            rollback: "previous-release"
        })).toEqual({ valid: true, missing: [] });
    });

    it("reports missing contract fields deterministically", () => {
        const engine = new DeploymentContractEngine();
        expect(engine.validate({ target: "production" })).toEqual({
            valid: false,
            missing: ["artifact", "healthCheck", "rollback"]
        });
    });
});
