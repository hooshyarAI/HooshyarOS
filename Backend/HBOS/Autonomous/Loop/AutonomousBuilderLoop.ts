import {
    ArchitectureDrivenBuildController
} from "../../Builder/Autonomous/ArchitectureDrivenBuildController";
import {
    ArchitectureRequirement
} from "../../Architecture/Decision/ArchitectureDecisionEngine";
import { ConstructionTool } from "../../Builder/Autonomous/AutonomousConstructionEngine";

export interface AutonomousBuildRequest extends ArchitectureRequirement {
    requestedBy?: string;
}

export class AutonomousBuilderLoop {
    constructor(private readonly tools: ConstructionTool[]) {}

    run(request: AutonomousBuildRequest) {
        const controller = new ArchitectureDrivenBuildController(this.tools);
        const result = controller.construct(request);

        return {
            request,
            lifecycle: [
                "architecture",
                "decision",
                "plan",
                "tool_selection",
                "generate",
                "verify",
                "repair_when_required",
                "re_verify",
                "finalize"
            ],
            result,
            status: result.ok ? "completed" : "blocked"
        };
    }

    static selfTest(): void {
        const tools: ConstructionTool[] = [
            {
                name: "architecture",
                execute: () => ({ ok: true })
            },
            {
                name: "codex",
                execute: () => ({ ok: true })
            },
            {
                name: "python",
                execute: () => ({ ok: true })
            },
            {
                name: "git",
                execute: () => ({ ok: true })
            }
        ];

        const result = new AutonomousBuilderLoop(tools).run({
            capabilityId: "autonomous-loop-test",
            capability: "build from final architecture",
            targetEngine: "Autonomous Operations Engine",
            requestedBy: "self-test"
        });

        if (result.status !== "completed" || !result.result.ok) {
            throw new Error("AutonomousBuilderLoop self-test failed");
        }
    }
}
