import { CapabilityStage } from "./CapabilityGateEvaluator";

export type AutonomousAction =
    | "CREATE_ARTIFACT"
    | "RUN_BEHAVIORAL_VERIFICATION"
    | "RUN_INTEGRATION_VERIFICATION"
    | "RUN_PRODUCTION_VERIFICATION"
    | "NO_ACTION";

export type ActionPriority = "P0" | "P1" | "P2";

export interface CapabilityWorkItem {
    name: string;
    stage: CapabilityStage;
    blockers: string[];
    missingPaths: string[];
    priority: ActionPriority;
}

export interface AutonomousActionPlan {
    capability: string;
    action: AutonomousAction;
    priority: ActionPriority;
    targets: string[];
    executionAllowed: boolean;
}

const PRIORITY_ORDER: ActionPriority[] = ["P0", "P1", "P2"];

export class AutonomousActionPlanner {
    plan(items: CapabilityWorkItem[]): AutonomousActionPlan[] {
        return [...items]
            .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority))
            .map((item) => {
                if (item.stage === "COMMERCIAL_READY") {
                    return {
                        capability: item.name,
                        action: "NO_ACTION" as const,
                        priority: item.priority,
                        targets: [],
                        executionAllowed: false,
                    };
                }

                if (item.missingPaths.length > 0) {
                    return {
                        capability: item.name,
                        action: "CREATE_ARTIFACT" as const,
                        priority: item.priority,
                        targets: [...item.missingPaths],
                        executionAllowed: true,
                    };
                }

                const actionByStage: Partial<Record<CapabilityStage, AutonomousAction>> = {
                    IMPLEMENTED: "RUN_BEHAVIORAL_VERIFICATION",
                    BEHAVIORALLY_VERIFIED: "RUN_INTEGRATION_VERIFICATION",
                    INTEGRATION_VERIFIED: "RUN_PRODUCTION_VERIFICATION",
                };
                const action = actionByStage[item.stage] ?? "NO_ACTION";

                return {
                    capability: item.name,
                    action,
                    priority: item.priority,
                    targets: [],
                    executionAllowed: action !== "NO_ACTION",
                };
            });
    }
}
