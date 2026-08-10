import { AutonomousProjectMission } from "../Autonomous/Runtime/AutonomousProjectMission";

describe("AutonomousProjectMission", () => {
    it("does not manufacture a platform capability when the canonical backlog is exhausted", () => {
        const mission = new AutonomousProjectMission(process.cwd());
        const next = mission.nextPlatformMission();

        expect(next).toBeNull();
    });

    it("keeps the completion gate separate from real platform capabilities", () => {
        const mission = new AutonomousProjectMission(process.cwd());
        const next = mission.nextMission();

        expect(next.capabilityId).not.toBe("platform.continuation");
    });
});
