import { AutonomousSelfRepairRunner } from "../Autonomous/Runtime/AutonomousSelfRepairRunner";
import { AutonomousDevelopmentResult } from "../Architecture/Autonomous/AutonomousDevelopmentLoop";

describe("AutonomousSelfRepairRunner", () => {
    it("routes a real repair execution through the governed capability and records evidence", () => {
        const runner = new AutonomousSelfRepairRunner();
        const execute = jest.fn((_: unknown): AutonomousDevelopmentResult => ({
            status: "completed",
            result: { ok: true, stage: "FINALIZE", idempotent: false, issues: [] }
        }));
        const rollback = jest.fn();
        const development = { execute };
        const recovery = { rollback };
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
        expect(execute).toHaveBeenCalled();
        expect(rollback).toHaveBeenCalledWith(root, { capabilityId: "assistant.test", commit: "before" });
    });
});
