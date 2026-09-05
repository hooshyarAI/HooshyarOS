import { execFileSync } from "node:child_process";
import { AutonomousAssistantRuntime } from "./AutonomousAssistantRuntime";
import { AutonomousBuildDaemon } from "../../Autonomous/Runtime/AutonomousBuildDaemon";

export type AssistantOrchestratorStatus =
    | "RUNNING"
    | "ASSISTANT_FAILED"
    | "ASSISTANT_BLOCKED"
    | "PLATFORM_COMPLETED"
    | "PLATFORM_BLOCKED";

export class AssistantOrchestrator {
    private readonly runCheckpoint: { commit: string; clean: boolean };

    constructor(
        private readonly runtime = new AutonomousAssistantRuntime(),
        private readonly daemon = new AutonomousBuildDaemon()
    ) {
        this.runCheckpoint = this.repositorySnapshot();
    }

    private repositorySnapshot(): { commit: string; clean: boolean } {
        try {
            const commit = execFileSync("git", ["rev-parse", "HEAD"], {
                cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]
            }).trim();
            const status = execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all", "--", ".", ":(exclude)node_modules"], {
                cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]
            }).trim();
            return { commit, clean: status === "" };
        } catch {
            return { commit: "", clean: false };
        }
    }

    private repairRunOwnedWorkspace(): void {
        if (!this.runCheckpoint.clean || !this.runCheckpoint.commit) {
            throw new Error("ASSISTANT_HANDOFF_REQUIRES_CLEAN_RUN_CHECKPOINT");
        }

        execFileSync("git", ["reset", "--hard", this.runCheckpoint.commit], {
            cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]
        });
        execFileSync("git", ["clean", "-fd", "--", ".", ":(exclude)node_modules"], {
            cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]
        });

        const repaired = this.repositorySnapshot();
        if (!repaired.clean || repaired.commit !== this.runCheckpoint.commit) {
            throw new Error("ASSISTANT_HANDOFF_WORKSPACE_REPAIR_FAILED");
        }
    }

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

        const beforeHandoff = this.repositorySnapshot();
        if (!beforeHandoff.clean) {
            this.repairRunOwnedWorkspace();
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
