import { AssistantBrainOrchestrator } from "../Assistant/Autonomous/Production/AssistantBrainOrchestrator";

test("HooshyarOS production evolution brain uses the governed Python construction path", async () => {
    const brain = new AssistantBrainOrchestrator();

    const result = await brain.execute("Autonomous HooshyarOS evolution");

    expect(result.context.contextFound).toBe(true);
    expect(result.provider.provider).toBe("python");
    expect(result.build.provider).toBe("python");
    expect(result.build.delegated).toBe(true);
    expect(result.build.owner).toBe("AutonomousBuildDaemon");
});
