export interface RepairPlan {
    issue: string;
    targetFile?: string;
    action: string;
    capabilityId?: string;
    governingPrinciples: string[];
    requiredEvidence: string[];
}

export interface RepairExecutionResult {
    repaired: boolean;
    plan: RepairPlan;
}

/**
 * Governed repair planning boundary.
 * The engine records why a repair is allowed and what evidence must prove it;
 * mutation itself remains delegated to the platform's repair/tooling layer.
 */
export class AutonomousRepairEngine {
    createPlan(issue: string, output?: string, capabilityId?: string): RepairPlan {
        let targetFile = "unknown";

        if (output) {
            const match = output.match(/([A-Za-z0-9_\/\\.-]+\.ts)/);
            if (match) targetFile = match[1];
        }

        return {
            issue,
            targetFile,
            capabilityId,
            action: "Diagnose root cause, select platform-native repair capability, apply minimal implementation repair, rerun verification",
            governingPrinciples: [
                "PLATFORM_FIRST",
                "ARCHITECTURE_GOVERNED",
                "ROOT_CAUSE_FIRST",
                "NO_COSMETIC_REPAIR",
                "SELF_VERIFICATION_MANDATORY"
            ],
            requiredEvidence: [
                "ROOT_CAUSE_IDENTIFIED",
                "IMPLEMENTATION_CHANGED_OR_IDEMPOTENTLY_VERIFIED",
                "BEHAVIOR_VERIFIED",
                "INTEGRATION_VERIFIED",
                "REGRESSION_VERIFIED"
            ]
        };
    }

    execute(plan: RepairPlan): RepairExecutionResult {
        // Planning is not repair. The mutation-capable platform tool must execute
        // the plan and return evidence before this boundary can report repaired=true.
        return {
            repaired: false,
            plan
        };
    }
}
