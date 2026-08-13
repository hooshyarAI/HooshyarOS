import { ArchitectureRequirement } from "../Decision/ArchitectureDecisionEngine";

export interface GoalPlan {
    goal: any;
    requirement: ArchitectureRequirement;
    tasks: string[];
}

export class GoalPlanner {
    plan(goal: any): GoalPlan {
        const capabilityId = String(goal?.capabilityId || goal?.id || "autonomous-capability");
        const repairOf = goal?.repairOf ? String(goal.repairOf) : undefined;
        const requirement: ArchitectureRequirement = {
            capabilityId,
            capability: String(goal?.capability || goal?.description || goal?.goal || "autonomous construction"),
            targetEngine: String(goal?.targetEngine || "Autonomous Operations Engine"),
            dependencies: Array.isArray(goal?.dependencies) ? goal.dependencies : [],
            ...(repairOf ? { repairOf } : {})
        };

        return {
            goal,
            requirement,
            tasks: ["architecture", "decision", "plan", "generate", "verify", "repair", "finalize"]
        };
    }

    static selfTest(): void {
        const result = new GoalPlanner().plan({
            capabilityId: "repair-typescript-contract-integrity",
            repairOf: "repair-product.web-application-shell",
            capability: "repair the selected product capability",
            targetEngine: "Assistant Engine"
        });

        if (
            result.requirement.capabilityId !== "repair-typescript-contract-integrity" ||
            result.requirement.repairOf !== "repair-product.web-application-shell" ||
            result.tasks.length < 5
        ) {
            throw new Error("GoalPlanner self-test failed");
        }
    }
}
