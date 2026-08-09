import { ArchitectureRequirement } from "../Decision/ArchitectureDecisionEngine";

export interface GoalPlan {
    goal: any;
    requirement: ArchitectureRequirement;
    tasks: string[];
}

export class GoalPlanner {
    plan(goal: any): GoalPlan {
        const requirement: ArchitectureRequirement = {
            capabilityId: String(goal?.capabilityId || goal?.id || "autonomous-capability"),
            capability: String(goal?.capability || goal?.description || goal?.goal || "autonomous construction"),
            targetEngine: String(goal?.targetEngine || "Autonomous Operations Engine"),
            dependencies: Array.isArray(goal?.dependencies) ? goal.dependencies : []
        };

        return {
            goal,
            requirement,
            tasks: ["architecture", "decision", "plan", "generate", "verify", "repair", "finalize"]
        };
    }

    static selfTest(): void {
        const result = new GoalPlanner().plan({
            capabilityId: "planner-test",
            capability: "autonomous construction"
        });

        if (result.requirement.capabilityId !== "planner-test" || result.tasks.length < 5) {
            throw new Error("GoalPlanner self-test failed");
        }
    }
}
