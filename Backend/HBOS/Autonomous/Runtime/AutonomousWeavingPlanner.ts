export interface WeavingMission {
    capabilityId: string;
    capability: string;
    targetEngine: string;
    dependencies: string[];
}

export interface WeavingPlan {
    safe: boolean;
    action: "BUILD" | "REPAIR";
    capabilityId: string;
    targetEngine: string;
    rationale: string;
    preconditions: string[];
    dependencyOrder: string[];
    verificationOrder: string[];
    stopConditions: string[];
    risk: "LOW" | "MEDIUM" | "HIGH";
}

/**
 * Turns a selected canonical mission into an explicit, deterministic
 * construction plan before any tool is allowed to execute it.
 *
 * The planner does not invent capabilities or reorder the canonical backlog.
 * It makes the selected knot explicit: why it is next, what must be true
 * before execution, how it will be verified, and when construction must stop.
 */
export class AutonomousWeavingPlanner {
    plan(mission: WeavingMission, workspaceClean: boolean): WeavingPlan {
        const repair = mission.capabilityId.startsWith("repair-");
        const risk = this.riskFor(mission);
        const preconditions = [
            "selected capability belongs to the canonical mission",
            "architecture owner is explicit",
            "dependencies are evaluated before execution",
            "verification evidence is required before advancement"
        ];

        if (!workspaceClean && !repair) {
            return {
                safe: false,
                action: "BUILD",
                capabilityId: mission.capabilityId,
                targetEngine: mission.targetEngine,
                rationale: "refuse a new knot while the working tree is dirty; repair and verify first",
                preconditions,
                dependencyOrder: [...mission.dependencies],
                verificationOrder: ["repair workspace", "run focused verification", "run integration verification"],
                stopConditions: ["working tree remains dirty", "verification fails", "unexpected artifact owner appears"],
                risk
            };
        }

        const dependencyOrder = [...mission.dependencies];
        const verificationOrder = [
            "focused test",
            "integration verification",
            "repository evidence audit"
        ];

        return {
            safe: true,
            action: repair ? "REPAIR" : "BUILD",
            capabilityId: mission.capabilityId,
            targetEngine: mission.targetEngine,
            rationale: repair
                ? "repair the current knot before touching the next knot"
                : dependencyOrder.length > 0
                    ? "weave the selected knot only after its dependency colors are already anchored"
                    : "weave the selected root knot in canonical order",
            preconditions,
            dependencyOrder,
            verificationOrder,
            stopConditions: [
                "execution reports failure",
                "verification evidence is incomplete",
                "repository change is not produced when a build was required",
                "a second capability owner is detected"
            ],
            risk
        };
    }

    private riskFor(mission: WeavingMission): "LOW" | "MEDIUM" | "HIGH" {
        const id = mission.capabilityId.toLowerCase();
        if (id.includes("cloud") || id.includes("deployment") || id.includes("security")) return "HIGH";
        if (mission.dependencies.length >= 3) return "MEDIUM";
        return "LOW";
    }
}
