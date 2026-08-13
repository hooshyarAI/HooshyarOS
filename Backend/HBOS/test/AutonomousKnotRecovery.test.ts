import { AutonomousKnotRecovery } from "../Autonomous/Runtime/AutonomousKnotRecovery";

describe("AutonomousKnotRecovery", () => {
    const checkpoint = { capabilityId: "platform.user-management", commit: "abc123" };
    const recovery = new AutonomousKnotRecovery();

    it("advances only when execution, verification and repository evidence agree", () => {
        const decision = recovery.observe(checkpoint, {
            capabilityId: checkpoint.capabilityId,
            executionOk: true,
            verificationComplete: true,
            repositoryChanged: true
        });

        expect(decision).toEqual(expect.objectContaining({
            recover: false,
            action: "ADVANCE",
            checkpoint
        }));
    });

    it("re-winds the current knot when verification detects a wrong result", () => {
        const decision = recovery.observe(checkpoint, {
            capabilityId: checkpoint.capabilityId,
            executionOk: true,
            verificationComplete: false,
            repositoryChanged: true
        });

        expect(decision).toEqual(expect.objectContaining({
            recover: true,
            action: "REPAIR",
            repairCapabilityId: "repair-platform.user-management",
            checkpoint
        }));
        expect(decision.rationale).toContain("last verified checkpoint");
    });

    it("does not create nested repair prefixes when a repair knot fails again", () => {
        const repairCheckpoint = { capabilityId: "repair-product.financial-statement-analysis", commit: "abc123" };
        const decision = recovery.observe(repairCheckpoint, {
            capabilityId: repairCheckpoint.capabilityId,
            executionOk: true,
            verificationComplete: false,
            repositoryChanged: true
        });

        expect(decision.repairCapabilityId).toBe("repair-product.financial-statement-analysis");
    });
});