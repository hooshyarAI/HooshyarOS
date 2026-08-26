import { AutonomousAssistantRuntime } from "../Assistant/Autonomous/AutonomousAssistantRuntime";
import { AssistantOrchestrator } from "../Assistant/Autonomous/AssistantOrchestrator";
import { AutonomousBuildDaemon } from "../Autonomous/Runtime/AutonomousBuildDaemon";

describe("Assistant platform handoff", () => {
  it("hands off to the canonical daemon after Assistant completion", async () => {
    const runtime = { execute: jest.fn().mockResolvedValue({ mission: { status: "COMPLETED" } }) } as unknown as AutonomousAssistantRuntime;
    const daemon = { run: jest.fn().mockReturnValue({ status: "completed" }) } as unknown as AutonomousBuildDaemon;
    const result = await new AssistantOrchestrator(runtime, daemon).start("continue construction");
    expect(daemon.run).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("PLATFORM_COMPLETED");
  });
  it("keeps a failed Assistant from starting platform construction", async () => {
    const runtime = { execute: jest.fn().mockResolvedValue({ mission: { status: "FAILED" } }) } as unknown as AutonomousAssistantRuntime;
    const daemon = { run: jest.fn() } as unknown as AutonomousBuildDaemon;
    const result = await new AssistantOrchestrator(runtime, daemon).start("repair construction");
    expect(daemon.run).not.toHaveBeenCalled();
    expect(result.status).toBe("ASSISTANT_FAILED");
    expect(result.platform).toBeNull();
  });
});
