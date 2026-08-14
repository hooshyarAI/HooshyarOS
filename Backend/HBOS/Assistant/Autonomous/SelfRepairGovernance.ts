import type { FailureInput, RepairStrategy } from "./SelfRepairCapability";

export interface GovernanceDecision {
    allowed: boolean;
    reason: string;
}

/** Non-bypassable governance gate for autonomous repair and external escalation. */
export class SelfRepairGovernance {
    authorizeRepair(failure: FailureInput, strategy: RepairStrategy): GovernanceDecision {
        if (failure.architectureBoundary && strategy.architecturalFit < 5) {
            return { allowed: false, reason: "REPAIR_CROSSES_DECLARED_ARCHITECTURE_BOUNDARY" };
        }
        if (strategy.risk >= 10 && strategy.architecturalFit < 8) {
            return { allowed: false, reason: "HIGH_RISK_STRATEGY_WITHOUT_SUFFICIENT_ARCHITECTURAL_FIT" };
        }
        return { allowed: true, reason: "REPAIR_WITHIN_GOVERNED_BOUNDARY" };
    }

    authorizeManualIntervention(blockedProof: string[] | undefined): GovernanceDecision {
        const proof = blockedProof ?? [];
        const hasRootCause = proof.some(item => item.startsWith("ROOT_CAUSE_CLASS:"));
        const hasAttempts = proof.some(item => item.startsWith("ATTEMPTS:"));
        const hasExternalBoundary = proof.some(item => /external boundary|EXTERNAL_BOUNDARY/i.test(item));
        if (hasRootCause && hasAttempts && hasExternalBoundary) {
            return { allowed: true, reason: "AUTONOMOUS_BOUNDARY_PROVEN" };
        }
        return { allowed: false, reason: "AUTONOMOUS_SELF_REPAIR_NOT_PROVEN_BLOCKED" };
    }
}
