import { AutonomousKnotRecovery } from "../Autonomous/Runtime/AutonomousKnotRecovery";

describe("AutonomousKnotRecovery", () => {
    const checkpoint = { capabilityId: "platform.user-management", commit: "abc123" };
    const recovery = new AutonomousKnotRecovery();

    it("advances only when execution, verification and repository evidence agree", () => {
        const decision = recovery.observe(checkpoint, { capabilityId: checkpoint.capabilityId, executionOk: true, verificationComplete: true, repositoryChanged: true });
        expect(decision).toEqual(expect.objectContaining({ recover: false, action: "ADVANCE", checkpoint }));
    });

    it("selects a root-cause repair mission from heterogeneous verification evidence", () => {
        const decision = recovery.observe(checkpoint, {
            capabilityId: checkpoint.capabilityId,
            executionOk: false,
            verificationComplete: false,
            repositoryChanged: false,
            failures: ["FAIL CommercialRuntimeServer.test.ts Received: 400", "FAIL AutonomousConstructionEngine.quality.test.ts QUALITY_BEHAVIOR_UNVERIFIED"]
        });

        expect(decision.recover).toBe(true);
        expect(decision.action).toBe("REPAIR");
        expect(decision.repairCapabilityId).toBe("repair-commercial-runtime-server");
        expect(decision.repairCluster?.rootCause).toBe("commercial-runtime-request-or-test-lifecycle-contract");
        expect(decision.repairEvidence).toEqual(expect.arrayContaining([expect.stringContaining("CommercialRuntimeServer")]));
    });

    it("falls back safely when no root cause can be classified", () => {
        const decision = recovery.observe(checkpoint, {
            capabilityId: checkpoint.capabilityId,
            executionOk: true,
            verificationComplete: false,
            repositoryChanged: true,
            failures: ["unclassified failure"]
        });
        expect(decision.recover).toBe(true);
        expect(decision.repairCapabilityId).toBe("repair-platform.user-management");
    });

    it("does not create nested repair prefixes when a repair knot fails again", () => {
        const repairCheckpoint = { capabilityId: "repair-product.financial-statement-analysis", commit: "abc123" };
        const decision = recovery.observe(repairCheckpoint, {
            capabilityId: repairCheckpoint.capabilityId,
            executionOk: true,
            verificationComplete: false,
            repositoryChanged: true,
            failures: ["unclassified failure"]
        });
        expect(decision.repairCapabilityId).toBe("repair-product.financial-statement-analysis");
    });
});
