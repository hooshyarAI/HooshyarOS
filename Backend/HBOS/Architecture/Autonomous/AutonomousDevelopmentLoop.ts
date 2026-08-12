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

    static canonicalizeGoal(goal: any): any {
        if (!goal || typeof goal !== "object") return goal;
        const capabilityId = String(goal?.capabilityId || goal?.id || "autonomous-capability");
        const canonicalCapabilityId = capabilityId.startsWith("repair-")
            ? capabilityId.slice("repair-".length)
            : capabilityId;
        return { ...goal, capabilityId: canonicalCapabilityId };
    }

    execute(goal: any): AutonomousDevelopmentResult {
        const canonicalGoal = AutonomousDevelopmentLoop.canonicalizeGoal(goal);
        const plan = this.planner.plan(canonicalGoal);
        const controller = new ArchitectureDrivenBuildController(this.tools);
        const result = controller.construct(plan.requirement);
        const outcome: AutonomousDevelopmentResult = {
            goal: canonicalGoal,
            plan,
            result,
            status: result.ok ? "completed" : "blocked"
        };
        if (outcome.status === "completed") {
            AutonomousDevelopmentLoop.verifyCompletionEvidence(outcome);
        }
        return outcome;
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
        AutonomousDevelopmentLoop.verifyCompletionEvidence(result);
    }

    static verifyCompletionEvidence(result: AutonomousDevelopmentResult): void {
        if (!result.result.ok || result.status !== "completed") {
            throw new Error("Completion evidence is invalid: construction did not complete successfully");
        }
        if (!result.plan || !result.plan.requirement) {
            throw new Error("Completion evidence is invalid: no canonical plan was produced");
        }
        const trace = result.result.trace;
        const requiredStages = ["ARCHITECTURE", "PLAN", "GENERATE", "VERIFY", "FINALIZE"] as const;
        const missingStages = requiredStages.filter(stage => !trace.includes(stage));
        if (missingStages.length > 0) {
            throw new Error(`Completion evidence is invalid: missing construction stages ${missingStages.join(", ")}`);
        }
        if (!result.result.details || !result.result.details.trim()) {
            throw new Error("Completion evidence is invalid: construction produced no verification details");
        }
        if (result.result.stage !== "FINALIZE") {
            throw new Error("Completion evidence is invalid: construction did not reach FINALIZE");
        }
    }
}
