import { ProvenanceTrace } from "../Core/ProvenanceTrace";
import { Authorization, AuthorizationResult } from "../Security/Authorization";
import { AuthorizationGuard } from "../Security/AuthorizationGuard";
import { PrincipalType } from "../Security/Principals";
import { SecurityContext } from "../Security/SecurityContext";
import { GovernanceEngine, GovernancePolicy } from "../Engines/GovernanceEngine";
import { AutonomousOperationsEngine, WorkflowPlan } from "../Engines/AutonomousOperationsEngine";
import {
    LearningRecord,
    OrganizationalIntelligenceEngine,
    ProcessMetrics
} from "../Engines/OrganizationalIntelligenceEngine";
import { SecurityEventLogger } from "../Entities/SecurityEventLogger";
import { SQLitePersistenceStore } from "./SQLitePersistenceStore";
import { KpiIntelligenceService, KpiTrend } from "./KpiIntelligenceService";

/**
 * Canonical product-layer owner for `product.organizational-execution`.
 *
 * Scope: turn an already-validated human decision recommendation into governed
 * work with an explicit human approval boundary, assignment, due date,
 * KPI/outcome, evidence, feedback and a durable audit trail.
 *
 * Authority model (never collapsed):
 * - Human decision recommendation: owned by DecisionWorkbench (this coordinator
 *   only consumes the persisted decision artifact).
 * - Human approval/governance gate: owned here + GovernanceEngine; requires the
 *   frozen Authorization.APPROVE authority and rejects autonomous principals.
 * - Governed execution lifecycle: owned here.
 * - Autonomous execution: owned by AutonomousOperationsEngine and only reachable
 *   through AuthorizationGuard.checkAutonomousExecute. This coordinator plans a
 *   governed workflow through that engine but never invokes its autonomous
 *   execution path and never simulates human approval.
 *
 * The coordinator composes existing canonical owners; it does not create a
 * duplicate workflow engine:
 * - GovernanceEngine    -> approval authorization, tenant boundary, policy gate
 * - AutonomousOperationsEngine -> governed WorkflowPlan (planning only)
 * - OrganizationalIntelligenceEngine -> before/after learning evidence
 * - KpiIntelligenceService -> KPI outcome trend evidence
 * - SQLitePersistenceStore -> durable, tenant-scoped work-item persistence
 */

export interface ProductCapabilityResult { status: "READY" | "BLOCKED"; }

export const DEFAULT_DECISION_ARTIFACT_KEY = "decision-workbench:latest";

const WORK_ITEM_INDEX_KEY = "organizational-execution:index";
const workItemKey = (workItemId: string) => `organizational-execution:work-item:${workItemId}`;

export type WorkItemStatus =
    | "AWAITING_APPROVAL"
    | "APPROVED"
    | "REJECTED"
    | "ASSIGNED"
    | "IN_PROGRESS"
    | "BLOCKED"
    | "COMPLETED"
    | "CANCELLED";

export type WorkItemPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type WorkItemAction =
    | "PROPOSE"
    | "APPROVE"
    | "REJECT"
    | "ASSIGN"
    | "START"
    | "BLOCK"
    | "COMPLETE"
    | "CANCEL";

export type WorkItemBlockCode =
    | "VALIDATION"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "INVALID_TRANSITION"
    | "GOVERNANCE"
    | "PLANNING"
    | "DECISION_REQUIRED"
    | "PERSISTENCE";

export type WorkItemAssigneeType = "HumanUser" | "ServiceIdentity" | "ExternalIntegration";

export interface WorkItemProvenance {
    readonly traceId: string;
    readonly inputHash: string;
    readonly outputHash: string;
    readonly verificationStatus: "VERIFIED" | "PENDING" | "FAILED";
    readonly sourceRef: string;
    readonly timestamp: string;
}

export interface DecisionArtifactReference {
    readonly key: string;
    readonly problem: string;
    readonly recommendation: string | null;
    readonly method: string;
    readonly weightsSource: string;
}

export interface WorkItemApproval {
    readonly approvedBy: string;
    readonly actorType: string;
    readonly authority: "APPROVE";
    readonly approvedAt: string;
    readonly tenantId: string;
    readonly decisionArtifactKey: string;
    readonly decisionTraceId: string;
    readonly governanceTraceId: string;
    readonly comments?: string;
}

export interface WorkItemRejection {
    readonly rejectedBy: string;
    readonly actorType: string;
    readonly authority: "APPROVE";
    readonly rejectedAt: string;
    readonly tenantId: string;
    readonly reason: string;
}

export interface WorkItemAssignment {
    readonly assigneeId: string;
    readonly assigneeType: WorkItemAssigneeType;
    readonly assignedBy: string;
    readonly assignedAt: string;
    readonly dueDate: string | null;
}

export interface WorkItemEvidence {
    readonly id: string;
    readonly type: string;
    readonly description?: string;
    readonly ref?: string;
    readonly sha256?: string;
}

export interface KpiOutcomeInput {
    readonly metric: string;
    readonly target: number;
    readonly actual: number;
    readonly unit?: string;
    /** Optional KPI observation series used to derive trend evidence. */
    readonly series?: readonly number[];
}

export interface KpiOutcome {
    readonly metric: string;
    readonly target: number;
    readonly actual: number;
    readonly unit: string | null;
    readonly variance: number;
    readonly achievementRate: number;
    readonly status: "ABOVE_TARGET" | "ON_TARGET" | "BELOW_TARGET";
    readonly trend: KpiTrend | null;
}

export interface WorkItemFeedbackInput {
    readonly result: "DELIVERED" | "PARTIAL" | "NOT_DELIVERED";
    readonly notes?: string;
    readonly metrics?: { readonly before: ProcessMetrics; readonly after: ProcessMetrics };
}

export interface WorkItemFeedback {
    readonly submittedBy: string;
    readonly submittedAt: string;
    readonly result: "DELIVERED" | "PARTIAL" | "NOT_DELIVERED";
    readonly notes?: string;
    readonly learning: LearningRecord | null;
}

export interface WorkItemStatusEvent {
    readonly at: string;
    readonly by: string;
    readonly actorType: string;
    readonly action: WorkItemAction;
    readonly from: WorkItemStatus | "NONE";
    readonly to: WorkItemStatus;
    readonly reason?: string;
    readonly traceId: string;
}

export interface OrganizationalWorkItem {
    readonly workItemId: string;
    readonly capabilityId: "product.organizational-execution";
    readonly targetEngine: "Organizational Intelligence Engine";
    readonly tenantId: string;
    readonly title: string;
    readonly description: string;
    readonly priority: WorkItemPriority;
    readonly status: WorkItemStatus;
    readonly decision: DecisionArtifactReference;
    readonly createdBy: string;
    readonly createdAt: string;
    readonly approval: WorkItemApproval | null;
    readonly rejection: WorkItemRejection | null;
    readonly workflow: WorkflowPlan | null;
    readonly assignment: WorkItemAssignment | null;
    readonly dueDate: string | null;
    readonly kpi: KpiOutcome | null;
    readonly evidence: readonly WorkItemEvidence[];
    readonly feedback: WorkItemFeedback | null;
    readonly history: readonly WorkItemStatusEvent[];
    readonly provenance: WorkItemProvenance;
}

export interface ProposeWorkItemInput {
    readonly title: string;
    readonly description?: string;
    readonly priority?: WorkItemPriority;
    readonly decisionArtifactKey?: string;
}

export interface ApproveWorkItemInput {
    readonly comments?: string;
    readonly requiredApprovals?: readonly string[];
    readonly maxDurationMs?: number;
    readonly maxBudget?: number;
}

export interface RejectWorkItemInput {
    readonly reason: string;
}

export interface AssignWorkItemInput {
    readonly assigneeId: string;
    readonly assigneeType?: WorkItemAssigneeType;
    readonly dueDate?: string;
}

export interface BlockWorkItemInput {
    readonly reason: string;
}

export interface CompleteWorkItemInput {
    readonly kpi?: KpiOutcomeInput;
    readonly evidence?: readonly WorkItemEvidence[];
    readonly feedback?: WorkItemFeedbackInput;
    /** Convenience alias for feedback.metrics. */
    readonly metrics?: { readonly before: ProcessMetrics; readonly after: ProcessMetrics };
}

export interface CancelWorkItemInput {
    readonly reason?: string;
}

export interface WorkItemOperationResult {
    readonly status: "READY" | "BLOCKED";
    readonly reason?: string;
    readonly code?: WorkItemBlockCode;
    readonly workItem?: OrganizationalWorkItem;
}

export interface OrganizationalExecutionDependencies {
    readonly governance?: GovernanceEngine;
    readonly autonomousOperations?: AutonomousOperationsEngine;
    readonly organizational?: OrganizationalIntelligenceEngine;
    readonly kpi?: KpiIntelligenceService;
}

const PRIORITIES: readonly WorkItemPriority[] = Object.freeze(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

const SOURCE_REF = "OrganizationalExecutionCoordinator";

export class OrganizationalExecutionCoordinator {
    readonly capabilityId = "product.organizational-execution";
    readonly targetEngine = "Organizational Intelligence Engine";

    private readonly governance: GovernanceEngine;
    private readonly autonomousOperations: AutonomousOperationsEngine;
    private readonly organizational: OrganizationalIntelligenceEngine;
    private readonly kpi: KpiIntelligenceService;
    private readonly cache = new Map<string, OrganizationalWorkItem>();

    constructor(
        private readonly persistence?: SQLitePersistenceStore,
        dependencies: OrganizationalExecutionDependencies = {}
    ) {
        this.governance = dependencies.governance ?? new GovernanceEngine();
        this.autonomousOperations = dependencies.autonomousOperations ?? new AutonomousOperationsEngine();
        this.organizational = dependencies.organizational ?? new OrganizationalIntelligenceEngine();
        this.kpi = dependencies.kpi ?? new KpiIntelligenceService();
    }

    initialize(): { status: "READY" } {
        return { status: "READY" };
    }

    /**
     * Deterministic readiness boundary retained from the original minimal
     * contract. The governed capability is exposed through the lifecycle
     * methods below.
     */
    execute(input: string): ProductCapabilityResult {
        return { status: input && input.trim() ? "READY" : "BLOCKED" };
    }

    setSecurityLogger(logger: SecurityEventLogger): void {
        this.governance.setSecurityLogger(logger);
    }

    addGovernancePolicy(policy: GovernancePolicy): void {
        this.governance.addPolicy(policy);
    }

    getGovernancePolicies(): GovernancePolicy[] {
        return this.governance.getPolicies();
    }

    async propose(context: SecurityContext, input: ProposeWorkItemInput): Promise<WorkItemOperationResult> {
        const baseline = this.requireGovernedHuman(context);
        if (baseline.ok === false) return this.blocked(baseline.reason, baseline.code);
        const permission = this.checkAuthorization(context, Authorization.EXECUTE);
        if (permission.ok === false) return this.blocked(permission.reason, permission.code);

        const title = this.cleanText(input?.title);
        if (!title) return this.blocked("work-item-title-required", "VALIDATION");

        const priority = input?.priority ?? "MEDIUM";
        if (!PRIORITIES.includes(priority)) return this.blocked("work-item-priority-invalid", "VALIDATION");

        const decisionKey = this.cleanText(input?.decisionArtifactKey) || DEFAULT_DECISION_ARTIFACT_KEY;
        const decision = await this.loadDecisionArtifact(context.tenantId as string, decisionKey);
        if (!decision) return this.blocked("work-item-decision-artifact-required", "DECISION_REQUIRED");

        const nowIso = new Date().toISOString();
        const workItemId = ProvenanceTrace.createTraceId();
        const inputSnapshot = { title, priority, decisionKey, tenantId: context.tenantId };
        const provenance = this.buildProvenance(inputSnapshot, { status: "AWAITING_APPROVAL" }, [
            "validate-tenant-context",
            "authorize-create-execution",
            "resolve-decision-artifact",
            "create-work-item"
        ], workItemId);

        const item: OrganizationalWorkItem = Object.freeze({
            workItemId,
            capabilityId: "product.organizational-execution" as const,
            targetEngine: "Organizational Intelligence Engine" as const,
            tenantId: context.tenantId as string,
            title,
            description: this.cleanText(input?.description) ?? "",
            priority,
            status: "AWAITING_APPROVAL" as const,
            decision,
            createdBy: context.actor?.id ?? "unknown",
            createdAt: nowIso,
            approval: null,
            rejection: null,
            workflow: null,
            assignment: null,
            dueDate: null,
            kpi: null,
            evidence: Object.freeze([]),
            feedback: null,
            history: Object.freeze([this.historyEvent("PROPOSE", "NONE", "AWAITING_APPROVAL", context, provenance.traceId)]),
            provenance
        });

        await this.saveItem(item);
        return this.ready(item);
    }

    async getWorkItem(context: SecurityContext, workItemId: string): Promise<OrganizationalWorkItem | null> {
        const baseline = this.requireGovernedHuman(context);
        if (baseline.ok === false) return null;
        const id = this.cleanText(workItemId);
        if (!id) return null;
        const item = await this.loadItem(context.tenantId as string, id);
        return item ?? null;
    }

    async listWorkItems(context: SecurityContext): Promise<OrganizationalWorkItem[]> {
        const baseline = this.requireGovernedHuman(context);
        if (baseline.ok === false) return [];
        return this.listTenantItems(context.tenantId as string);
    }

    async approve(context: SecurityContext, workItemId: string, input: ApproveWorkItemInput = {}): Promise<WorkItemOperationResult> {
        const baseline = this.requireGovernedHuman(context);
        if (baseline.ok === false) return this.blocked(baseline.reason, baseline.code);

        const loaded = await this.loadForTransition(context, workItemId, "AWAITING_APPROVAL");
        if (loaded.ok === false) return this.blocked(loaded.reason, loaded.code);
        const item = loaded.workItem;

        const governance = this.governance.evaluate({
            action: "APPROVE_DECISION",
            securityContext: context,
            target: { tenantId: item.tenantId },
            parameters: {
                workItemId: item.workItemId,
                decisionArtifactKey: item.decision.key,
                comments: this.cleanText(input?.comments)
            }
        });
        if (governance.status !== "ALLOWED") {
            return this.blocked(`governance-${governance.status.toLowerCase()}:${governance.reasons.join("|")}`, "GOVERNANCE");
        }

        const plan = this.autonomousOperations.planWorkflow(item.title, {
            requiredApprovals: input?.requiredApprovals ?? ["APPROVE_DECISION"],
            maxDuration: input?.maxDurationMs,
            maxBudget: input?.maxBudget
        });
        if (plan.status !== "READY") {
            return this.blocked(`workflow-plan-blocked:${plan.provenance.reasoningSteps.join("|")}`, "PLANNING");
        }

        const nowIso = new Date().toISOString();
        const approval: WorkItemApproval = Object.freeze({
            approvedBy: context.actor?.id ?? "unknown",
            actorType: context.actor?.type ?? "unknown",
            authority: "APPROVE" as const,
            approvedAt: nowIso,
            tenantId: item.tenantId,
            decisionArtifactKey: item.decision.key,
            decisionTraceId: governance.traceId,
            governanceTraceId: governance.traceId,
            comments: this.cleanText(input?.comments)
        });

        const provenance = this.buildProvenance(
            { workItemId: item.workItemId, action: "APPROVE" },
            { status: "APPROVED", decision: item.decision.key },
            ["authorize-approve", "governance-evaluate", "plan-governed-workflow"],
            governance.traceId
        );

        const updated = this.withTransition(item, "APPROVED", "APPROVE", context, provenance, {
            approval,
            workflow: plan
        }, undefined);
        await this.saveItem(updated);
        return this.ready(updated);
    }

    async reject(context: SecurityContext, workItemId: string, input: RejectWorkItemInput): Promise<WorkItemOperationResult> {
        const baseline = this.requireGovernedHuman(context);
        if (baseline.ok === false) return this.blocked(baseline.reason, baseline.code);

        const reason = this.cleanText(input?.reason);
        if (!reason) return this.blocked("work-item-rejection-reason-required", "VALIDATION");

        const loaded = await this.loadForTransition(context, workItemId, "AWAITING_APPROVAL");
        if (loaded.ok === false) return this.blocked(loaded.reason, loaded.code);
        const item = loaded.workItem;

        const governance = this.governance.evaluate({
            action: "APPROVE_DECISION",
            securityContext: context,
            target: { tenantId: item.tenantId },
            parameters: { workItemId: item.workItemId, decision: "REJECT", reason }
        });
        if (governance.status !== "ALLOWED") {
            return this.blocked(`governance-${governance.status.toLowerCase()}:${governance.reasons.join("|")}`, "GOVERNANCE");
        }

        const rejection: WorkItemRejection = Object.freeze({
            rejectedBy: context.actor?.id ?? "unknown",
            actorType: context.actor?.type ?? "unknown",
            authority: "APPROVE" as const,
            rejectedAt: new Date().toISOString(),
            tenantId: item.tenantId,
            reason
        });

        const provenance = this.buildProvenance(
            { workItemId: item.workItemId, action: "REJECT" },
            { status: "REJECTED", reason },
            ["authorize-approve", "governance-evaluate", "record-rejection"],
            governance.traceId
        );

        const updated = this.withTransition(item, "REJECTED", "REJECT", context, provenance, { rejection }, reason);
        await this.saveItem(updated);
        return this.ready(updated);
    }

    async assign(context: SecurityContext, workItemId: string, input: AssignWorkItemInput): Promise<WorkItemOperationResult> {
        const baseline = this.requireGovernedHuman(context);
        if (baseline.ok === false) return this.blocked(baseline.reason, baseline.code);
        const permission = this.checkAuthorization(context, Authorization.EXECUTE);
        if (permission.ok === false) return this.blocked(permission.reason, permission.code);

        const assigneeId = this.cleanText(input?.assigneeId);
        if (!assigneeId) return this.blocked("work-item-assignee-required", "VALIDATION");
        const assigneeType = input?.assigneeType ?? "HumanUser";
        if (!["HumanUser", "ServiceIdentity", "ExternalIntegration"].includes(assigneeType)) {
            return this.blocked("work-item-assignee-type-invalid", "VALIDATION");
        }
        const dueDate = this.normalizeDate(input?.dueDate);
        if (input?.dueDate !== undefined && dueDate === null) {
            return this.blocked("work-item-due-date-invalid", "VALIDATION");
        }

        const loaded = await this.loadForTransition(context, workItemId, "APPROVED");
        if (loaded.ok === false) return this.blocked(loaded.reason, loaded.code);
        const item = loaded.workItem;

        const assignment: WorkItemAssignment = Object.freeze({
            assigneeId,
            assigneeType,
            assignedBy: context.actor?.id ?? "unknown",
            assignedAt: new Date().toISOString(),
            dueDate
        });

        const provenance = this.buildProvenance(
            { workItemId: item.workItemId, action: "ASSIGN", assigneeId },
            { status: "ASSIGNED", assigneeId, dueDate },
            ["authorize-execute", "validate-assignment", "assign-responsible-actor"]
        );

        const updated = this.withTransition(item, "ASSIGNED", "ASSIGN", context, provenance, {
            assignment,
            dueDate
        }, undefined);
        await this.saveItem(updated);
        return this.ready(updated);
    }

    async start(context: SecurityContext, workItemId: string): Promise<WorkItemOperationResult> {
        return this.simpleTransition(context, workItemId, "ASSIGNED", "IN_PROGRESS", "START");
    }

    async block(context: SecurityContext, workItemId: string, input: BlockWorkItemInput): Promise<WorkItemOperationResult> {
        const baseline = this.requireGovernedHuman(context);
        if (baseline.ok === false) return this.blocked(baseline.reason, baseline.code);
        const permission = this.checkAuthorization(context, Authorization.EXECUTE);
        if (permission.ok === false) return this.blocked(permission.reason, permission.code);
        const reason = this.cleanText(input?.reason);
        if (!reason) return this.blocked("work-item-block-reason-required", "VALIDATION");

        const item = await this.loadItem(context.tenantId as string, workItemId);
        if (!item) return this.blocked("work-item-not-found", "NOT_FOUND");
        if (item.status !== "ASSIGNED" && item.status !== "IN_PROGRESS") {
            return this.blocked(`invalid-transition:${item.status}->BLOCKED`, "INVALID_TRANSITION");
        }

        const provenance = this.buildProvenance(
            { workItemId: item.workItemId, action: "BLOCK" },
            { status: "BLOCKED", reason },
            ["authorize-execute", "record-block"]
        );
        const updated = this.withTransition(item, "BLOCKED", "BLOCK", context, provenance, {}, reason);
        await this.saveItem(updated);
        return this.ready(updated);
    }

    async complete(context: SecurityContext, workItemId: string, input: CompleteWorkItemInput = {}): Promise<WorkItemOperationResult> {
        const baseline = this.requireGovernedHuman(context);
        if (baseline.ok === false) return this.blocked(baseline.reason, baseline.code);
        const permission = this.checkAuthorization(context, Authorization.EXECUTE);
        if (permission.ok === false) return this.blocked(permission.reason, permission.code);

        const loaded = await this.loadForTransition(context, workItemId, "IN_PROGRESS");
        if (loaded.ok === false) return this.blocked(loaded.reason, loaded.code);
        const item = loaded.workItem;

        const kpi = this.buildKpiOutcome(input?.kpi);
        if (input?.kpi && !kpi) return this.blocked("work-item-kpi-invalid", "VALIDATION");

        const evidence = this.buildEvidence(input?.evidence);
        const feedback = this.buildFeedback(context, input);

        const provenance = this.buildProvenance(
            { workItemId: item.workItemId, action: "COMPLETE", metric: kpi?.metric ?? null },
            { status: "COMPLETED", kpi: kpi?.status ?? null, feedback: feedback?.result ?? null },
            [
                "authorize-execute",
                "record-kpi-outcome",
                "record-evidence",
                "record-feedback",
                "derive-organizational-learning"
            ]
        );

        const updated = this.withTransition(item, "COMPLETED", "COMPLETE", context, provenance, {
            kpi,
            evidence: Object.freeze([...item.evidence, ...evidence]),
            feedback
        }, undefined);
        await this.saveItem(updated);
        return this.ready(updated);
    }

    async cancel(context: SecurityContext, workItemId: string, input: CancelWorkItemInput = {}): Promise<WorkItemOperationResult> {
        const baseline = this.requireGovernedHuman(context);
        if (baseline.ok === false) return this.blocked(baseline.reason, baseline.code);
        const permission = this.checkAuthorization(context, Authorization.EXECUTE);
        if (permission.ok === false) return this.blocked(permission.reason, permission.code);

        const item = await this.loadItem(context.tenantId as string, workItemId);
        if (!item) return this.blocked("work-item-not-found", "NOT_FOUND");
        const cancellable: WorkItemStatus[] = ["AWAITING_APPROVAL", "APPROVED", "ASSIGNED", "IN_PROGRESS", "BLOCKED"];
        if (!cancellable.includes(item.status)) {
            return this.blocked(`invalid-transition:${item.status}->CANCELLED`, "INVALID_TRANSITION");
        }

        const reason = this.cleanText(input?.reason);
        const provenance = this.buildProvenance(
            { workItemId: item.workItemId, action: "CANCEL" },
            { status: "CANCELLED", reason: reason ?? null },
            ["authorize-execute", "cancel-work-item"]
        );
        const updated = this.withTransition(item, "CANCELLED", "CANCEL", context, provenance, {}, reason);
        await this.saveItem(updated);
        return this.ready(updated);
    }

    private async simpleTransition(
        context: SecurityContext,
        workItemId: string,
        from: WorkItemStatus,
        to: WorkItemStatus,
        action: WorkItemAction
    ): Promise<WorkItemOperationResult> {
        const baseline = this.requireGovernedHuman(context);
        if (baseline.ok === false) return this.blocked(baseline.reason, baseline.code);
        const permission = this.checkAuthorization(context, Authorization.EXECUTE);
        if (permission.ok === false) return this.blocked(permission.reason, permission.code);

        const loaded = await this.loadForTransition(context, workItemId, from);
        if (loaded.ok === false) return this.blocked(loaded.reason, loaded.code);

        const provenance = this.buildProvenance(
            { workItemId: loaded.workItem.workItemId, action },
            { status: to },
            ["authorize-execute", `transition-${from.toLowerCase()}-to-${to.toLowerCase()}`]
        );
        const updated = this.withTransition(loaded.workItem, to, action, context, provenance, {}, undefined);
        await this.saveItem(updated);
        return this.ready(updated);
    }

    private requireGovernedHuman(context: SecurityContext): { ok: true } | { ok: false; reason: string; code: WorkItemBlockCode } {
        if (!context?.actor) {
            return { ok: false, reason: "security-context-actor-required", code: "FORBIDDEN" };
        }
        if (context.actor.type === PrincipalType.AutonomousOperation) {
            return { ok: false, reason: "autonomous-principal-cannot-perform-governed-execution", code: "FORBIDDEN" };
        }
        if (!context.tenantId?.trim()) {
            return { ok: false, reason: "tenant-context-required", code: "FORBIDDEN" };
        }
        return { ok: true };
    }

    private checkAuthorization(context: SecurityContext, action: Authorization): { ok: true } | { ok: false; reason: string; code: WorkItemBlockCode } {
        const decision = AuthorizationGuard.check(context, action);
        if (decision.result !== AuthorizationResult.PERMITTED) {
            return { ok: false, reason: `authorization-denied:${decision.reason}`, code: "FORBIDDEN" };
        }
        return { ok: true };
    }

    private async loadForTransition(
        context: SecurityContext,
        workItemId: string,
        expected: WorkItemStatus
    ): Promise<{ ok: true; workItem: OrganizationalWorkItem } | { ok: false; reason: string; code: WorkItemBlockCode }> {
        const id = this.cleanText(workItemId);
        if (!id) return { ok: false, reason: "work-item-id-required", code: "VALIDATION" };
        const item = await this.loadItem(context.tenantId as string, id);
        if (!item) return { ok: false, reason: "work-item-not-found", code: "NOT_FOUND" };
        if (item.status !== expected) {
            return { ok: false, reason: `invalid-transition:${item.status}->expected-${expected}`, code: "INVALID_TRANSITION" };
        }
        return { ok: true, workItem: item };
    }

    private withTransition(
        item: OrganizationalWorkItem,
        to: WorkItemStatus,
        action: WorkItemAction,
        context: SecurityContext,
        provenance: WorkItemProvenance,
        changes: Partial<OrganizationalWorkItem>,
        reason: string | undefined
    ): OrganizationalWorkItem {
        const event = this.historyEvent(action, item.status, to, context, provenance.traceId, reason);
        return Object.freeze({
            ...item,
            ...changes,
            status: to,
            history: Object.freeze([...item.history, event]),
            provenance
        });
    }

    private historyEvent(
        action: WorkItemAction,
        from: WorkItemStatus | "NONE",
        to: WorkItemStatus,
        context: SecurityContext,
        traceId: string,
        reason?: string
    ): WorkItemStatusEvent {
        return Object.freeze({
            at: new Date().toISOString(),
            by: context.actor?.id ?? "unknown",
            actorType: context.actor?.type ?? "unknown",
            action,
            from,
            to,
            reason,
            traceId
        });
    }

    private buildProvenance(input: unknown, output: unknown, steps: readonly string[], traceId?: string): WorkItemProvenance {
        const resolvedTrace = traceId ?? ProvenanceTrace.createTraceId();
        return Object.freeze({
            traceId: resolvedTrace,
            inputHash: ProvenanceTrace.hashInput(JSON.stringify(input ?? null)),
            outputHash: ProvenanceTrace.hashInput(JSON.stringify(output ?? null)),
            verificationStatus: "VERIFIED" as const,
            sourceRef: SOURCE_REF,
            timestamp: new Date().toISOString()
        });
    }

    private buildKpiOutcome(input: KpiOutcomeInput | undefined): KpiOutcome | null {
        if (!input) return null;
        const metric = this.cleanText(input.metric);
        if (!metric || !Number.isFinite(input.target) || !Number.isFinite(input.actual)) return null;
        const variance = input.actual - input.target;
        const achievementRate = input.target !== 0 ? input.actual / input.target : 0;
        const status: KpiOutcome["status"] = variance > 1e-9 ? "ABOVE_TARGET" : variance < -1e-9 ? "BELOW_TARGET" : "ON_TARGET";
        const series = Array.isArray(input.series) ? input.series.filter((v) => Number.isFinite(v)) : [];
        const trend = series.length >= 2 ? this.kpi.trend(series) : null;
        return Object.freeze({
            metric,
            target: input.target,
            actual: input.actual,
            unit: this.cleanText(input.unit) ?? null,
            variance,
            achievementRate,
            status,
            trend
        });
    }

    private buildEvidence(input: readonly WorkItemEvidence[] | undefined): WorkItemEvidence[] {
        if (!Array.isArray(input)) return [];
        return input
            .filter((entry) => entry && this.cleanText(entry.type))
            .map((entry, index) => Object.freeze({
                id: this.cleanText(entry.id) || `EVIDENCE-${index + 1}`,
                type: this.cleanText(entry.type) as string,
                description: this.cleanText(entry.description),
                ref: this.cleanText(entry.ref),
                sha256: this.cleanText(entry.sha256)
            }));
    }

    private buildFeedback(context: SecurityContext, input: CompleteWorkItemInput): WorkItemFeedback | null {
        if (!input?.feedback) return null;
        const metrics = input.feedback.metrics ?? input.metrics;
        const learning = metrics && metrics.before && metrics.after
            ? this.organizational.learnFromExecution(metrics.before, metrics.after)
            : null;
        return Object.freeze({
            submittedBy: context.actor?.id ?? "unknown",
            submittedAt: new Date().toISOString(),
            result: input.feedback.result,
            notes: this.cleanText(input.feedback.notes),
            learning
        });
    }

    private async loadDecisionArtifact(tenantId: string, key: string): Promise<DecisionArtifactReference | null> {
        if (!this.persistence) return null;
        const record = await this.persistence.read({ tenantId }, key);
        const value = record?.value as Record<string, unknown> | undefined;
        if (!value || typeof value !== "object") return null;
        if (value.status !== "READY" || value.tenantId !== tenantId) return null;
        const recommendation = value.recommendation as { alternative?: unknown } | null | undefined;
        return Object.freeze({
            key,
            problem: this.cleanText(value.problem) ?? "",
            recommendation: this.cleanText(recommendation?.alternative) ?? null,
            method: this.cleanText(value.method) ?? "EXPERT_CHOICE",
            weightsSource: this.cleanText(value.weightsSource) ?? "DECLARED"
        });
    }

    private async loadItem(tenantId: string, workItemId: string): Promise<OrganizationalWorkItem | null> {
        const cached = this.cache.get(workItemId);
        if (cached && cached.tenantId === tenantId) return cached;
        if (!this.persistence) return null;
        const record = await this.persistence.read({ tenantId }, workItemKey(workItemId));
        const item = record?.value as OrganizationalWorkItem | undefined;
        if (!item || item.tenantId !== tenantId) return null;
        this.cache.set(workItemId, item);
        return item;
    }

    private async saveItem(item: OrganizationalWorkItem): Promise<void> {
        this.cache.set(item.workItemId, item);
        if (!this.persistence) return;
        await this.persistence.write({ tenantId: item.tenantId }, workItemKey(item.workItemId), item);
        await this.addToIndex(item.tenantId, item.workItemId);
    }

    private async listTenantItems(tenantId: string): Promise<OrganizationalWorkItem[]> {
        const items: OrganizationalWorkItem[] = [];
        const seen = new Set<string>();
        if (this.persistence) {
            const record = await this.persistence.read({ tenantId }, WORK_ITEM_INDEX_KEY);
            const ids = Array.isArray(record?.value) ? (record?.value as unknown[]).filter((v): v is string => typeof v === "string") : [];
            for (const id of ids) {
                const item = await this.loadItem(tenantId, id);
                if (item) { items.push(item); seen.add(item.workItemId); }
            }
        }
        for (const item of this.cache.values()) {
            if (item.tenantId === tenantId && !seen.has(item.workItemId)) items.push(item);
        }
        return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    }

    private async addToIndex(tenantId: string, workItemId: string): Promise<void> {
        if (!this.persistence) return;
        const record = await this.persistence.read({ tenantId }, WORK_ITEM_INDEX_KEY);
        const ids = Array.isArray(record?.value) ? (record.value as unknown[]).filter((v): v is string => typeof v === "string") : [];
        if (!ids.includes(workItemId)) {
            ids.push(workItemId);
            await this.persistence.write({ tenantId }, WORK_ITEM_INDEX_KEY, ids);
        }
    }

    private normalizeDate(value: string | undefined): string | null {
        if (value === undefined || value === null) return null;
        const text = this.cleanText(value);
        if (!text) return null;
        const parsed = Date.parse(text);
        if (Number.isNaN(parsed)) return null;
        return new Date(parsed).toISOString();
    }

    private cleanText(value: unknown): string | undefined {
        if (typeof value !== "string") return undefined;
        const trimmed = value.trim();
        return trimmed ? trimmed : undefined;
    }

    private ready(workItem: OrganizationalWorkItem): WorkItemOperationResult {
        return Object.freeze({ status: "READY", workItem });
    }

    private blocked(reason: string, code: WorkItemBlockCode): WorkItemOperationResult {
        return Object.freeze({ status: "BLOCKED", reason, code });
    }
}
