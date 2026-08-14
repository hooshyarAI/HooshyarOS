import { AutonomousSelfRepairRunner } from "../Autonomous/Runtime/AutonomousSelfRepairRunner";
import { AutonomousDevelopmentResult } from "../Architecture/Autonomous/AutonomousDevelopmentLoop";
import { AutonomousKnotRecovery } from "../Autonomous/Runtime/AutonomousKnotRecovery";

describe("AutonomousSelfRepairRunner", () => {
    it("routes a real repair execution through the governed capability and records evidence", () => {
        const runner = new AutonomousSelfRepairRunner();
        const development = {
            execute: jest.fn<AutonomousDevelopmentResult, [unknown]>(() => ({ status: "completed", result: { ok: true, stage: "FINALIZE", idempotent: false, issues: [] } }))
        } as unknown as AutonomousDevelopmentLoopLike;
        const recovery = {
            rollback: jest.fn()
        } as unknown as AutonomousKnotRecoveryLike;
        let snapshotCalls = 0;
        const root = "D:/HooshyarOS";
        const result = runner.run({
            root,
            checkpoint: { capabilityId: "assistant.test", commit: "before" },
            missionCapabilityId: "assistant.test",
            targetEngine: "Autonomous Operations Engine",
            dependencies: [],
            repairDescription: "controlled self-repair test",
            failures: ["Gradle/JDK dependency failure"],
            development: development as never,
            recovery: recovery as never,
            snapshot: () => ({ commit: snapshotCalls++ === 0 ? "before" : "after", clean: true })
        });

        expect(result.repairCase.capabilityId).toBe("assistant.autonomous.self-repair");
        expect(result.repairCase.outcome).toBe("FIXED");
        expect(result.repairCase.evidence).toEqual(expect.arrayContaining(["STRATEGY=FOCUSED_CANONICAL_REPAIR", "WORKTREE_CLEAN=true"]));
        expect(development.execute).toHaveBeenCalled();
        expect(recovery.rollback).toHaveBeenCalledWith(root, { capabilityId: "assistant.test", commit: "before" });
    });
});

type AutonomousDevelopmentLoopLike = { execute: jest.Mock };
type AutonomousKnotRecoveryLike = { rollback: jest.Mock };
