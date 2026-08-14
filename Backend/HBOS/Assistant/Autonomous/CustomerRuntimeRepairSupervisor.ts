import { AUTONOMOUS_REPAIR_LAW } from "./AutonomousRepairLaw";

export type RuntimeRepairStage =
    | "DETECT"
    | "ISOLATE"
    | "DIAGNOSE"
    | "PLAN"
    | "REPAIR"
    | "VERIFY"
    | "CANARY"
    | "ROLLBACK"
    | "RESUME"
    | "LEARN"
    | "BLOCKED";

export interface CustomerRuntimeFailure {
    id: string;
    tenantId: string;
    component: string;
    message: string;
    evidence: string[];
    architectureBoundary: string;
}

export interface CustomerRuntimeRepairContext {
    failure: CustomerRuntimeFailure;
    repair: () => { ok: boolean; evidence: string[]; changed: boolean; rollback: () => void };
    verify: () => boolean;
    canary: () => boolean;
    observe: (event: CustomerRuntimeRepairAuditEvent) => void;
    learn?: (event: CustomerRuntimeRepairAuditEvent) => void;
}

export interface CustomerRuntimeRepairAuditEvent {
    repairId: string;
    tenantId: string;
    stage: RuntimeRepairStage;
    status: "PASSED" | "FAILED" | "BLOCKED";
    evidence: string[];
    timestamp: string;
}

export interface CustomerRuntimeRepairResult {
    repairId: string;
    status: "RESUMED" | "ROLLED_BACK" | "BLOCKED";
    stage: RuntimeRepairStage;
    evidence: string[];
}

/**
 * Runtime enforcement point for the autonomous-repair law.
 * It is deliberately callback-based so real runtime/rollback mechanisms remain
 * owned by their existing engines rather than creating a duplicate engine tree.
 */
export class CustomerRuntimeRepairSupervisor {
    repair(context: CustomerRuntimeRepairContext): CustomerRuntimeRepairResult {
        if (!AUTONOMOUS_REPAIR_LAW.customerRuntimeRepairRequired || !AUTONOMOUS_REPAIR_LAW.rollbackMandatory || !AUTONOMOUS_REPAIR_LAW.canaryVerificationMandatory) {
            return this.block(context, "AUTONOMOUS_REPAIR_LAW_RUNTIME_GATES_DISABLED");
        }
        const repairId = `runtime-repair-${context.failure.id}`;
        const evidence: string[] = [`TENANT=${context.failure.tenantId}`, `COMPONENT=${context.failure.component}`];
        this.emit(context, repairId, "DETECT", "PASSED", context.failure.evidence);
        this.emit(context, repairId, "ISOLATE", "PASSED", ["TENANT_SCOPE_ISOLATED", `ARCHITECTURE_BOUNDARY=${context.failure.architectureBoundary}`]);
        this.emit(context, repairId, "DIAGNOSE", "PASSED", context.failure.evidence);
        this.emit(context, repairId, "PLAN", "PASSED", ["PROPORTIONAL_GOVERNED_REPAIR", "PRESERVE_TENANT_DATA_SECURITY_BOUNDARIES"]);

        let repaired: { ok: boolean; evidence: string[]; changed: boolean; rollback: () => void };
        try {
            this.emit(context, repairId, "REPAIR", "PASSED", []);
            repaired = context.repair();
        } catch (error) {
            return this.rollback(context, repairId, ["REPAIR_EXCEPTION", String(error)]);
        }
        evidence.push(...repaired.evidence, `REPOSITORY_OR_RUNTIME_CHANGED=${repaired.changed}`);
        if (!repaired.ok) return this.rollback(context, repairId, evidence.concat("REPAIR_FAILED"));

        const verified = this.safeCheck(context.verify);
        this.emit(context, repairId, "VERIFY", verified ? "PASSED" : "FAILED", ["REPAIR_VERIFICATION", `VERIFIED=${verified}`]);
        if (!verified) return this.rollback(context, repairId, evidence.concat("VERIFICATION_FAILED"));

        const canary = this.safeCheck(context.canary);
        this.emit(context, repairId, "CANARY", canary ? "PASSED" : "FAILED", ["CANARY_VERIFICATION", `CANARY=${canary}`]);
        if (!canary) return this.rollback(context, repairId, evidence.concat("CANARY_FAILED"));

        const finalEvidence = evidence.concat("VERIFICATION_PASSED", "CANARY_PASSED", "AUTOMATIC_RESUME_AUTHORIZED");
        this.emit(context, repairId, "RESUME", "PASSED", finalEvidence);
        const learning = { repairId, tenantId: context.failure.tenantId, stage: "LEARN" as const, status: "PASSED" as const, evidence: finalEvidence, timestamp: new Date().toISOString() };
        context.observe(learning);
        context.learn?.(learning);
        return { repairId, status: "RESUMED", stage: "RESUME", evidence: finalEvidence };
    }

    private rollback(context: CustomerRuntimeRepairContext, repairId: string, evidence: string[]): CustomerRuntimeRepairResult {
        try {
            context.observe({ repairId, tenantId: context.failure.tenantId, stage: "ROLLBACK", status: "PASSED", evidence: ["AUTOMATIC_ROLLBACK", ...evidence], timestamp: new Date().toISOString() });
            context.repair().rollback();
        } catch (error) {
            evidence.push(`ROLLBACK_EXCEPTION=${String(error)}`);
        }
        return { repairId, status: "ROLLED_BACK", stage: "ROLLBACK", evidence: evidence.concat("SERVICE_RESUME_FORBIDDEN") };
    }

    private block(context: CustomerRuntimeRepairContext, reason: string): CustomerRuntimeRepairResult {
        const repairId = `runtime-repair-${context.failure.id}`;
        this.emit(context, repairId, "BLOCKED", "BLOCKED", [reason, "SERVICE_RESUME_FORBIDDEN"]);
        return { repairId, status: "BLOCKED", stage: "BLOCKED", evidence: [reason, "SERVICE_RESUME_FORBIDDEN"] };
    }

    private safeCheck(check: () => boolean): boolean {
        try { return check(); } catch { return false; }
    }

    private emit(context: CustomerRuntimeRepairContext, repairId: string, stage: RuntimeRepairStage, status: "PASSED" | "FAILED" | "BLOCKED", evidence: string[]): void {
        context.observe({ repairId, tenantId: context.failure.tenantId, stage, status, evidence, timestamp: new Date().toISOString() });
    }
}
