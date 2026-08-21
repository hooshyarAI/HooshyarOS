export interface RepairPlan {
    issue: string;
    targetFile?: string;
    action: string;
    capabilityId?: string;
    governingPrinciples: string[];
    requiredEvidence: string[];
}

export interface RepairExecutionEvidence {
    repaired: boolean;
    verificationPassed: boolean;
    integrationVerified: boolean;
    architectureVerified: boolean;
    failureTheoryAssessed: boolean;
    artifact?: unknown;
    reason?: string;
}

export interface RepairExecutionResult {
    repaired: boolean;
    plan: RepairPlan;
    evidence: RepairExecutionEvidence;
}

export interface RepairExecutionPort {
    execute(plan: RepairPlan): RepairExecutionResult;
}

/**
 * Governed repair planning boundary. Mutation is delegated to a platform-native
 * construction executor; this class never claims repair without verification evidence.
 */
export class AutonomousRepairEngine {
    constructor(private readonly executor?: RepairExecutionPort) {}

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
                "ARCHITECTURE_VERIFIED",
                "FAILURE_THEORY_ASSESSED",
                "REGRESSION_VERIFIED"
            ]
        };
    }

    execute(plan: RepairPlan): RepairExecutionResult {
        if (!this.executor) {
            return {
                repaired: false,
                plan,
                evidence: {
                    repaired: false,
                    verificationPassed: false,
                    integrationVerified: false,
                    architectureVerified: false,
                    failureTheoryAssessed: false,
                    reason: "REPAIR_EXECUTOR_UNWIRED"
                }
            };
        }
        const result = this.executor.execute(plan);
        if (!result.repaired || !result.evidence.verificationPassed || !result.evidence.integrationVerified || !result.evidence.architectureVerified || !result.evidence.failureTheoryAssessed) {
            return { ...result, repaired: false };
        }
        return result;
    }
}
