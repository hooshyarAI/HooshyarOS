import { AutonomousAssistantRuntime } from "./AutonomousAssistantRuntime";
import { AutonomousBuildDaemon } from "../../Autonomous/Runtime/AutonomousBuildDaemon";

export type AssistantOrchestratorStatus =
    | "RUNNING"
    | "ASSISTANT_FAILED"
    | "ASSISTANT_BLOCKED"
    | "PLATFORM_COMPLETED"
    | "PLATFORM_BLOCKED";

export class AssistantOrchestrator {
    constructor(
        private readonly runtime = new AutonomousAssistantRuntime(),
        private readonly daemon = new AutonomousBuildDaemon()
    ) {}

    async start(goal: string) {
        const result = await this.runtime.execute(goal);
        const mission = result.mission;

        if (mission?.status !== "COMPLETED") {
            const status: AssistantOrchestratorStatus =
                mission?.status === "BLOCKED"
                    ? "ASSISTANT_BLOCKED"
                    : mission?.status === "FAILED"
                        ? "ASSISTANT_FAILED"
                        : "RUNNING";

            return {
                status,
                assistant: status === "RUNNING" ? "ACTIVE" : "STOPPED",
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
