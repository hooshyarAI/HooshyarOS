jest.mock("node:child_process", () => ({ execFileSync: jest.fn() }));

import { execFileSync } from "node:child_process";
import { AutonomousAssistantRuntime } from "../Assistant/Autonomous/AutonomousAssistantRuntime";
import { AssistantOrchestrator } from "../Assistant/Autonomous/AssistantOrchestrator";
import { AutonomousBuildDaemon } from "../Autonomous/Runtime/AutonomousBuildDaemon";

describe("Assistant platform handoff", () => {
  beforeEach(() => jest.clearAllMocks());

  it("hands off to the canonical daemon after Assistant completion", async () => {
    const runtime = { execute: jest.fn().mockResolvedValue({ mission: { status: "COMPLETED" } }) } as unknown as AutonomousAssistantRuntime;
    const daemon = { run: jest.fn().mockReturnValue({ status: "completed" }) } as unknown as AutonomousBuildDaemon;
    const git = execFileSync as jest.MockedFunction<typeof execFileSync>;
    git.mockImplementation((command: string, args?: readonly string[]) => {
      if (command === "git" && args?.[0] === "rev-parse") return "HEAD\n" as any;
      if (command === "git" && args?.[0] === "status") return "" as any;
      return "" as any;
    });

    const result = await new AssistantOrchestrator(runtime, daemon).start("continue construction");
    expect(daemon.run).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("PLATFORM_COMPLETED");
  });

  it("keeps a failed Assistant from starting platform construction", async () => {
    const runtime = { execute: jest.fn().mockResolvedValue({ mission: { status: "FAILED" } }) } as unknown as AutonomousAssistantRuntime;
    const daemon = { run: jest.fn() } as unknown as AutonomousBuildDaemon;
    const git = execFileSync as jest.MockedFunction<typeof execFileSync>;
    git.mockImplementation((command: string, args?: readonly string[]) => {
      if (command === "git" && args?.[0] === "rev-parse") return "HEAD\n" as any;
      if (command === "git" && args?.[0] === "status") return "" as any;
      return "" as any;
    });

    const result = await new AssistantOrchestrator(runtime, daemon).start("repair construction");
    expect(daemon.run).not.toHaveBeenCalled();
    expect(result.status).toBe("ASSISTANT_FAILED");
    expect(result.platform).toBeNull();
  });

  it("repairs run-owned workspace drift before platform handoff", async () => {
    const runtime = { execute: jest.fn().mockResolvedValue({ mission: { status: "COMPLETED" } }) } as unknown as AutonomousAssistantRuntime;
    const daemon = { run: jest.fn().mockReturnValue({ status: "completed" }) } as unknown as AutonomousBuildDaemon;
    const git = execFileSync as jest.MockedFunction<typeof execFileSync>;
    let statusCalls = 0;

    git.mockImplementation((command: string, args?: readonly string[]) => {
      if (command === "git" && args?.[0] === "rev-parse") return "HEAD\n" as any;
      if (command === "git" && args?.[0] === "status") {
        statusCalls += 1;
        return statusCalls === 2 ? "?? run-created-artifact.tmp\n" : "" as any;
      }
      return "" as any;
    });

    const result = await new AssistantOrchestrator(runtime, daemon).start("continue construction");

    expect(execFileSync).toHaveBeenCalledWith("git", ["reset", "--hard", "HEAD"], expect.any(Object));
    expect(execFileSync).toHaveBeenCalledWith("git", ["clean", "-fd", "--", ".", ":(exclude)node_modules"], expect.any(Object));
    expect(daemon.run).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("PLATFORM_COMPLETED");
  });
});
