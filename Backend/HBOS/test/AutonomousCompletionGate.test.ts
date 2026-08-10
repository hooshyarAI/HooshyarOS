import { AutonomousProjectMission } from "../Autonomous/Runtime/AutonomousProjectMission";

describe("Autonomous Assistant completion gate", () => {
    it("selects the completion gate only when all canonical Assistant evidence is present", () => {
        const mission = new AutonomousProjectMission(process.cwd());
        const next = mission.nextMission();

        expect(next.capabilityId).toBe("assistant.completion.gate");
        expect(next.capability).toContain("completion gate");
        expect(next.evidence.clean).toBe(true);
    });
});
