import { ArchitectureDrivenBuildController } from "../../Builder/Autonomous/ArchitectureDrivenBuildController";
import { ConstructionResult, ConstructionTool } from "../../Builder/Autonomous/AutonomousConstructionEngine";
import { GoalPlanner, GoalPlan } from "../Planner/GoalPlanner";

export interface AutonomousDevelopmentResult {
    goal: any;
    plan: GoalPlan;
    result: ConstructionResult;
    status: "completed" | "blocked";
}

export class AutonomousDevelopmentLoop {
    private readonly planner = new GoalPlanner();

    constructor(private readonly tools: ConstructionTool[]) {}

    execute(goal: any): AutonomousDevelopmentResult {
        const plan = this.planner.plan(goal);
        const controller = new ArchitectureDrivenBuildController(this.tools);
        const result = controller.construct(plan.requirement);

        return {
            goal,
            plan,
            result,
            status: result.ok ? "completed" : "blocked"
        };
    }

    static selfTest(): void {
        const tools: ConstructionTool[] = [
            { name: "architecture", execute: () => ({ ok: true }) },
            { name: "python", execute: () => ({ ok: true }) },
            { name: "git", execute: () => ({ ok: true }) }
        ];

        const result = new AutonomousDevelopmentLoop(tools).execute({
            capabilityId: "autonomous-loop-test",
            capability: "architecture-driven construction"
        });

        if (result.status !== "completed" || !result.result.ok) {
            throw new Error("AutonomousDevelopmentLoop self-test failed");
        }
    }

    static verifyCompletionEvidence(result: AutonomousDevelopmentResult): void {
        if (!result.result.ok || result.status !== "completed") {
            throw new Error("Completion evidence is invalid: construction did not complete successfully");
        }
        if (!result.plan || !result.plan.requirement) {
            throw new Error("Completion evidence is invalid: no canonical plan was produced");
        }
    }
}
