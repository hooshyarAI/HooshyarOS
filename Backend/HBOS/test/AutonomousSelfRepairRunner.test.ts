import { AutonomousSelfRepairRunner } from "../Autonomous/Runtime/AutonomousSelfRepairRunner";

describe("AutonomousSelfRepairRunner", () => {
    it("routes a real repair execution through the governed capability and records evidence", () => {
        const runner = new AutonomousSelfRepairRunner();
        const development = {
            execute: jest.fn(() => ({ status: "completed", result: { ok: true, stage: "FINALIZE", idempotent: false, issues: [] } }))
        } as never;
        const recovery = { rollback: jest.fn() } as never;
        let snapshotCalls = 0;
        const result = runner.run({
            root: "D:/HooshyarOS",
            checkpoint: { capabilityId: "assistant.test", commit: "before" },
            missionCapabilityId: "assistant.test",
            targetEngine: "Autonomous Operations Engine",
            dependencies: [],
            repairDescription: "controlled self-repair test",
            failures: ["Gradle/JDK dependency failure"],
            development,
            recovery,
            snapshot: () => ({ commit: snapshotCalls++ === 0 ? "before" : "after", clean: true })
        });

        expect(result.repairCase.capabilityId).toBe("assistant.autonomous.self-repair");
        expect(result.repairCase.outcome).toBe("FIXED");
        expect(result.repairCase.evidence).toEqual(expect.arrayContaining(["STRATEGY=FOCUSED_CANONICAL_REPAIR", "WORKTREE_CLEAN=true"]));
        expect(development.execute).toHaveBeenCalled();
        expect(recovery.rollback).toHaveBeenCalled();
    });
});
