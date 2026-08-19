import { ArchitectureDrivenBuildController } from "../../Builder/Autonomous/ArchitectureDrivenBuildController";
import { ConstructionResult, ConstructionTool } from "../../Builder/Autonomous/AutonomousConstructionEngine";
import { GoalPlanner, GoalPlan } from "../Planner/GoalPlanner";
import { AutonomousEngineeringControlPlane, EngineeringCycleResult } from "../../Autonomous/Runtime/AutonomousEngineeringControlPlane";

export interface AutonomousDevelopmentResult {
    goal: any;
    plan: GoalPlan;
    result: ConstructionResult;
    status: "completed" | "blocked";
    engineeringControl?: EngineeringCycleResult;
}

export class AutonomousDevelopmentLoop {
    private readonly planner = new GoalPlanner();
    private readonly engineeringControl = new AutonomousEngineeringControlPlane();

    constructor(private readonly tools: ConstructionTool[]) {}

    static canonicalizeGoal(goal: any): any {
        if (!goal || typeof goal !== "object") return goal;
        const capabilityId = String(goal?.capabilityId || goal?.id || "autonomous-capability");
        // Repair intents are first-class intents. Preserve their identity so
        // the repair path remains distinguishable from the base capability.
        return { ...goal, capabilityId };
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
        } else {
            outcome.engineeringControl = this.engineeringControl.plan([{
                id: canonicalGoal.capabilityId,
                kind: this.failureKind(result),
                severity: 5,
                businessImpact: 5,
                recurrence: 1,
                recoverability: 3,
                observed: true,
                postconditionMissing: result.stage !== "FINALIZE",
                evidenceContradictory: !result.details || !result.details.trim(),
                canonicalPathBroken: this.failureKind(result) === "PROCESS"
            }]);
        }
        return outcome;
    }

    private failureKind(result: ConstructionResult): "BUILD" | "TEST" | "RUNTIME" | "INTEGRATION" | "SECURITY" | "PERSISTENCE" | "EVIDENCE" | "PROCESS" {
        const details = String(result.details || "").toLowerCase();
        if (details.includes("evidence") || details.includes("verification")) return "EVIDENCE";
        if (details.includes("security") || details.includes("authorization")) return "SECURITY";
        if (details.includes("persist") || details.includes("database") || details.includes("storage")) return "PERSISTENCE";
        if (details.includes("runtime") || details.includes("launch")) return "RUNTIME";
        if (details.includes("integration") || details.includes("contract")) return "INTEGRATION";
        if (details.includes("test")) return "TEST";
        if (details.includes("process") || details.includes("tool") || details.includes("planner")) return "PROCESS";
        return "BUILD";
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
