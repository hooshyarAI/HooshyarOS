import { AutonomousProjectMission } from "../Autonomous/Runtime/AutonomousProjectMission";

describe("AutonomousProjectMission", () => {
    it("selects the first genuinely missing canonical platform capability", () => {
        const mission = new AutonomousProjectMission(process.cwd());
        const next = mission.nextPlatformMission();

        expect(next?.capabilityId).toBe("platform.user-management");
        expect(next?.targetEngine).toBe("User Management Engine");
    });

    it("keeps the completion gate separate from real platform capabilities", () => {
        const mission = new AutonomousProjectMission(process.cwd());
        const next = mission.nextMission();

        expect(next.capabilityId).not.toBe("platform.continuation");
    });
});
