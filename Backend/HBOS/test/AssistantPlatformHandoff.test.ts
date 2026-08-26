import { AutonomousAssistantRuntime } from "../Assistant/Autonomous/AutonomousAssistantRuntime";
import { AssistantOrchestrator } from "../Assistant/Autonomous/AssistantOrchestrator";
import { AutonomousBuildDaemon } from "../Autonomous/Runtime/AutonomousBuildDaemon";

describe("Assistant platform handoff", () => {
    it("automatically invokes the canonical platform daemon when the Assistant mission completes", async () => {
        const runtime = {
            execute: jest.fn().mockResolvedValue({
                goal: "continue construction",
                mission: { status: "COMPLETED", completed: true, stage: "LEARN", progress: 100 },
                ctx: {},
                reasoning: {}
            })
        } as unknown as AutonomousAssistantRuntime;
        const daemon = {
            run: jest.fn().mockReturnValue({ status: "completed", cycles: 1, history: [] })
        } as unknown as AutonomousBuildDaemon;

        const orchestrator = new AssistantOrchestrator(runtime, daemon);
        const result = await orchestrator.start("continue construction");

        expect(daemon.run).toHaveBeenCalledTimes(1);
        expect(result.status).toBe("PLATFORM_COMPLETED");
        expect(result.assistant).toBe("COMPLETED");
        expect(result.platform).toEqual(expect.objectContaining({ status: "completed" }));
    });

    it("does not start platform construction after an Assistant failure", async () => {
        const runtime = {
            execute: jest.fn().mockResolvedValue({
                goal: "repair construction",
                mission: { status: "FAILED", completed: false, stage: "EXECUTE", progress: 0 },
                ctx: {},
                reasoning: {}
            })
        } as unknown as AutonomousAssistantRuntime;
        const daemon = {
            run: jest.fn()
        } as unknown as AutonomousBuildDaemon;

        const orchestrator = new AssistantOrchestrator(runtime, daemon);
        const result = await orchestrator.start("repair construction");

        expect(daemon.run).not.toHaveBeenCalled();
        expect(result.status).toBe("ASSISTANT_FAILED");
        expect(result.assistant).toBe("STOPPED");
        expect(result.platform).toBeNull();
    });
});
