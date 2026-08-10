import { AutonomousProjectMission } from "../Autonomous/Runtime/AutonomousProjectMission";

describe("Assistant completion gate", () => {
    it("selects the completion gate only when the canonical Assistant evidence is complete", () => {
        const mission = new AutonomousProjectMission(process.cwd());
        const next = mission.nextMission();

        expect(next.capabilityId).toBe("assistant.completion.gate");
        expect(next.targetEngine).toBe("Autonomous Operations Engine");
        expect(next.evidence.clean).toBe(true);
    });
});
