import { AutonomousAssistantRuntime } from "./AutonomousAssistantRuntime";
import { AutonomousBuildDaemon } from "../../Autonomous/Runtime/AutonomousBuildDaemon";

export type AssistantOrchestratorStatus = "RUNNING" | "ASSISTANT_COMPLETED" | "PLATFORM_COMPLETED" | "PLATFORM_BLOCKED";

export class AssistantOrchestrator {
    constructor(
        private readonly runtime = new AutonomousAssistantRuntime(),
        private readonly daemon = new AutonomousBuildDaemon()
    ) {}

    async start(goal: string) {
        const result = await this.runtime.execute(goal);
        const mission = result.mission;

        if (mission?.status !== "COMPLETED") {
            return {
                status: (mission?.status === "BLOCKED" || mission?.status === "FAILED" ? "ASSISTANT_COMPLETED" : "RUNNING") as AssistantOrchestratorStatus,
                assistant: "ACTIVE",
                result,
                platform: null
            };
        }

        const platform = this.daemon.run();
        const platformStatus: AssistantOrchestratorStatus = platform.status === "completed"
            ? "PLATFORM_COMPLETED"
            : "PLATFORM_BLOCKED";

        return {
            status: platformStatus,
            assistant: "COMPLETED",
            result,
            platform
        };
    }
}
