import { AutonomousPlatformContinuation } from "../Autonomous/Runtime/AutonomousPlatformContinuation";
import { AutonomousProjectMission } from "../Autonomous/Runtime/AutonomousProjectMission";

describe("AutonomousPlatformContinuation", () => {
    it("creates the canonical post-Assistant platform continuation mission", () => {
        const mission = new AutonomousPlatformContinuation().createMission();

        expect(mission.capabilityId).toBe("platform.continuation");
        expect(mission.source).toBe("assistant.completion.gate");
        expect(mission.instruction).toContain("AUDIT");
        expect(mission.instruction).toContain("IMPLEMENT");
        expect(mission.instruction).toContain("VERIFY");
        expect(mission.instruction).toContain("PUSH");
    });

    it("delegates continuation selection to the canonical platform backlog", () => {
        const projectMission = new AutonomousProjectMission(process.cwd());
        const continuation = new AutonomousPlatformContinuation();
        const selected = continuation.selectNextCapability(projectMission);

        expect(selected === null || selected.capabilityId).toBeTruthy();
        expect(selected?.capabilityId).not.toBe("platform.continuation");
    });

    it("selects the approved performance extension when the canonical backlog is exhausted", () => {
        const projectMission = {
            nextPlatformMission: () => null,
            snapshot: () => ({ root: ".tmp-performance-extension-root" })
        } as unknown as AutonomousProjectMission;

        const selected = new AutonomousPlatformContinuation().selectNextCapability(projectMission);

        expect(selected?.capabilityId).toBe("platform.performance-testing");
        expect(selected?.targetEngine).toBe("Performance Testing Engine");
    });

    it("does not turn an exhausted backlog into a fake continuation capability", () => {
        const projectMission = {
            nextPlatformMission: () => null,
            snapshot: () => ({ root: process.cwd() })
        } as unknown as AutonomousProjectMission;

        expect(new AutonomousPlatformContinuation().selectNextCapability(projectMission)).toBeNull();
    });
});
