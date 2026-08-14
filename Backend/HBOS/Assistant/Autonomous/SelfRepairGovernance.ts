import type { FailureInput, RepairStrategy } from "./SelfRepairCapability";
import { AUTONOMOUS_REPAIR_LAW } from "./AutonomousRepairLaw";

export interface GovernanceDecision {
    allowed: boolean;
    reason: string;
}

export interface RuntimeRepairRequest {
    tenantId: string;
    failureId: string;
    affectsCustomerData: boolean;
    securityBoundaryAtRisk: boolean;
    rollbackAvailable: boolean;
    canaryVerificationAvailable: boolean;
    observabilityAvailable: boolean;
}

/** Non-bypassable governance gate for autonomous repair and external escalation. */
export class SelfRepairGovernance {
    authorizeRepair(failure: FailureInput, strategy: RepairStrategy): GovernanceDecision {
        if (!AUTONOMOUS_REPAIR_LAW.autonomousFirst) {
            return { allowed: false, reason: "AUTONOMOUS_REPAIR_LAW_DISABLED" };
        }
        if (failure.architectureBoundary && strategy.architecturalFit < 5) {
            return { allowed: false, reason: "REPAIR_CROSSES_DECLARED_ARCHITECTURE_BOUNDARY" };
        }
        if (strategy.risk >= 10 && strategy.architecturalFit < 8) {
            return { allowed: false, reason: "HIGH_RISK_STRATEGY_WITHOUT_SUFFICIENT_ARCHITECTURAL_FIT" };
        }
        return { allowed: true, reason: "REPAIR_WITHIN_GOVERNED_BOUNDARY" };
    }

    /**
     * Production/customer repair gate. Runtime repair is autonomous by default,
     * but it may proceed only when the safety envelope needed to repair and
     * automatically recover a customer-facing service is present.
     */
    authorizeCustomerRuntimeRepair(request: RuntimeRepairRequest): GovernanceDecision {
        if (!AUTONOMOUS_REPAIR_LAW.customerRuntimeRepairRequired) {
            return { allowed: false, reason: "CUSTOMER_RUNTIME_AUTONOMOUS_REPAIR_DISABLED" };
        }
        if (!request.tenantId || !request.failureId) {
            return { allowed: false, reason: "CUSTOMER_RUNTIME_REPAIR_IDENTITY_REQUIRED" };
        }
        if (request.securityBoundaryAtRisk && !AUTONOMOUS_REPAIR_LAW.securityControlsNonBypassable) {
            return { allowed: false, reason: "SECURITY_BOUNDARY_GOVERNANCE_DISABLED" };
        }
        if (request.affectsCustomerData && !AUTONOMOUS_REPAIR_LAW.dataIntegrityNonBypassable) {
            return { allowed: false, reason: "DATA_INTEGRITY_GOVERNANCE_DISABLED" };
        }
        if (AUTONOMOUS_REPAIR_LAW.rollbackMandatory && !request.rollbackAvailable) {
            return { allowed: false, reason: "CUSTOMER_RUNTIME_ROLLBACK_REQUIRED" };
        }
        if (AUTONOMOUS_REPAIR_LAW.canaryVerificationMandatory && !request.canaryVerificationAvailable) {
            return { allowed: false, reason: "CUSTOMER_RUNTIME_CANARY_VERIFICATION_REQUIRED" };
        }
        if (AUTONOMOUS_REPAIR_LAW.observabilityMandatory && !request.observabilityAvailable) {
            return { allowed: false, reason: "CUSTOMER_RUNTIME_OBSERVABILITY_REQUIRED" };
        }
        return { allowed: true, reason: "CUSTOMER_RUNTIME_REPAIR_WITHIN_GOVERNED_BOUNDARY" };
    }

    authorizeManualIntervention(blockedProof: string[] | undefined): GovernanceDecision {
        if (!AUTONOMOUS_REPAIR_LAW.manualInterventionLastResort || !AUTONOMOUS_REPAIR_LAW.externalEscalationRequiresProof) {
            return { allowed: false, reason: "AUTONOMOUS_REPAIR_LAW_REQUIRES_AUTONOMOUS_FIRST" };
        }
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
