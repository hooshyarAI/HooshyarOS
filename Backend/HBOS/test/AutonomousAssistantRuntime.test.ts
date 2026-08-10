import { AutonomousAssistantRuntime } from "../Assistant/Autonomous/AutonomousAssistantRuntime";

test("HooshyarOS autonomous assistant runtime completes its canonical mission lifecycle", async () => {
    const assistant = new AutonomousAssistantRuntime();

    const result = await assistant.execute("Complete HooshyarOS");

    expect(result.reasoning.success).toBe(true);
    expect(result.ctx.memoryLoaded).toBe(true);
    expect(result.mission.completed).toBe(true);
    expect(result.mission.status).toBe("COMPLETED");
    expect(result.mission.stage).toBe("LEARN");
    expect(result.mission.lifecycle).toEqual([
        "OBSERVE",
        "REASON",
        "DECIDE",
        "PLAN",
        "EXECUTE",
        "VERIFY",
        "LEARN"
    ]);
});
