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
});
