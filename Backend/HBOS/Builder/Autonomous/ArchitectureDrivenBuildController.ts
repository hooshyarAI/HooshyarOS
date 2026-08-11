import {
    ArchitectureDecisionEngine,
    ArchitectureRequirement
} from "../../Architecture/Decision/ArchitectureDecisionEngine";
import {
    AutonomousConstructionEngine,
    ConstructionResult,
    ConstructionTool
} from "./AutonomousConstructionEngine";

export class ArchitectureDrivenBuildController {
    private readonly architectureBrain = new ArchitectureDecisionEngine();

    constructor(private readonly tools: ConstructionTool[]) {}

    construct(requirement: ArchitectureRequirement): ConstructionResult {
        const decision = this.architectureBrain.decide(requirement);

        if (decision.decision !== "approved" || !decision.plan) {
            return {
                ok: false,
                status: "BLOCKED",
                stage: "ARCHITECTURE",
                attempts: 0,
                selectedTool: "architecture-brain",
                issues: decision.reasons,
                trace: ["ARCHITECTURE"],
                details: `Construction blocked at ARCHITECTURE; reasons=${decision.reasons.join(" | ")}`
            };
        }

        // PLAN is an explicit governed stage: the approved architecture decision
        // becomes the concrete construction requirement before generation.
        const PLAN = decision.plan;
        return new AutonomousConstructionEngine(this.tools).build(PLAN);
    }

    static selfTest(): void {
        const controller = new ArchitectureDrivenBuildController([
            {
                name: "architecture",
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
        ]);

        const result = controller.construct({
            capabilityId: "controller-test",
            capability: "architecture-driven construction",
            targetEngine: "Autonomous Operations Engine"
        });

        if (!result.ok || result.status !== "BUILT") {
            throw new Error("ArchitectureDrivenBuildController self-test failed");
        }
    }
}