import { AutonomousMissionController } from "../Assistant/Autonomous/AutonomousMissionController";

test("Autonomous mission completes orchestration only when execution is verified", () => {
    const controller = new AutonomousMissionController();
    const result = controller.executeMission("Complete HooshyarOS platform");

    expect(result.status).toBe("COMPLETED");
    expect(result.completed).toBe(true);
    expect(result.progress).toBe(100);
    expect(result.stage).toBe("LEARN");
    expect(result.execution.length).toBeGreaterThan(0);
    expect(result.execution.every((task: any) => task.executed === true)).toBe(true);
});

test("Autonomous mission does not claim completion for an empty goal", () => {
    const controller = new AutonomousMissionController();
    const result = controller.executeMission("   ");

    expect(result.status).toBe("FAILED");
    expect(result.completed).toBe(false);
    expect(result.failure?.stage).toBe("OBSERVE");
});
