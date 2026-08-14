export type RepairDecision =
    | "REPAIR"
    | "RETRY_WITH_NEW_STRATEGY"
    | "ESCALATE"
    | "BLOCKED_WITH_PROOF";

export interface RepairEvidence {
    detection: string;
    rootCause: string;
    strategy: string;
    verification: string[];
}

export interface RepairPlan {
    issue: string;
    targetFile?: string;
    action: string;
    decision: RepairDecision;
    rootCauseRequired: true;
    evidenceRequired: true;
    stopConditions: string[];
}

export interface RepairExecutionResult {
    repaired: boolean;
    plan: RepairPlan;
    evidence: RepairEvidence;
}

export class AutonomousRepairEngine {
    createPlan(issue: string, output?: string): RepairPlan {
        const targetFile = this.extractTargetFile(output);

        return {
            issue,
            targetFile,
            action: "Audit failure, classify root cause, choose repair strategy, execute repair, rerun verification and produce evidence",
            decision: "REPAIR",
            rootCauseRequired: true,
            evidenceRequired: true,
            stopConditions: [
                "root cause cannot be classified",
                "repair crosses an architecture ownership boundary",
                "verification evidence is incomplete",
                "the same failed strategy would be repeated without new evidence",
                "repair does not produce verifiable repository state",
            ],
        };
    }

    execute(plan: RepairPlan, verificationPassed = false): RepairExecutionResult {
        const evidence: RepairEvidence = {
            detection: plan.issue,
            rootCause: verificationPassed
                ? "classified failure with successful verification"
                : "root cause must be classified before completion can be trusted",
            strategy: plan.action,
            verification: verificationPassed
                ? ["focused verification passed"]
                : ["verification pending"],
        };

        return {
            repaired: verificationPassed,
            plan: verificationPassed
                ? plan
                : { ...plan, decision: "BLOCKED_WITH_PROOF" },
            evidence,
        };
    }

    chooseDecision(
        verificationPassed: boolean,
        repeatedFailure: boolean,
        rootCauseKnown: boolean,
    ): RepairDecision {
        if (verificationPassed) return "REPAIR";
        if (!rootCauseKnown) return "ESCALATE";
        if (repeatedFailure) return "RETRY_WITH_NEW_STRATEGY";
        return "REPAIR";
    }

    private extractTargetFile(output?: string): string {
        if (!output) return "unknown";
        const match = output.match(/([A-Za-z0-9_\/\\.-]+\.ts)/);
        return match?.[1] ?? "unknown";
    }
}
