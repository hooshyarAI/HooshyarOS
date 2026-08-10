import { AutonomousPlatformContinuation } from "../Autonomous/Runtime/AutonomousPlatformContinuation";

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
});
