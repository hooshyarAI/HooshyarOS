import { randomBytes } from "node:crypto";
import { ProvenanceTrace } from "../Core/ProvenanceTrace";
import { MemoryEvent } from "../Entities/MemoryEvent";
import { KnowledgeEngine } from "../Engines/KnowledgeEngine";
import { ReasoningEngine } from "../Engines/ReasoningEngine";
import { GovernanceEngine } from "../Engines/GovernanceEngine";
import { ExecutiveIntelligenceEngine } from "../Engines/ExecutiveIntelligenceEngine";
import {
    OrganizationalIntelligenceEngine,
    ProcessMetrics,
    LearningRecord,
} from "../Engines/OrganizationalIntelligenceEngine";
import {
    AutonomousOperationsEngine,
    WorkflowConstraints,
    WorkflowPlan,
    WorkflowExecutionResult,
    ExecutionMonitor,
} from "../Engines/AutonomousOperationsEngine";
import {
    ImpactMeasurementService,
    BaselineMetrics,
    PostInterventionMetrics,
    ExpectedImpact,
    ImpactMeasurementResult,
} from "./ImpactMeasurementService";
import { DecisionWorkbench, DecisionWorkbenchInput, DecisionWorkbenchResult } from "./DecisionWorkbench";
import { SQLitePersistenceStore } from "./SQLitePersistenceStore";
import { SecurityContext } from "../Security/SecurityContext";
import { Principal } from "../Security/Principals";
import { Authorization } from "../Security/Authorization";

/**
 * Canonical product-layer owner for `product.organizational-problem-solving`.
 *
 * Scope: the first-class, persistent and traceable organizational
 * problem-solving lifecycle:
 *
 *   Problem Case -> Problem Definition -> Evidence Set -> Hypotheses
 *   -> Root-Cause Analysis -> Options/Scenarios -> Decision (governed)
 *   -> Action Plan -> Execution -> Outcome Measurement -> Learning
 *   -> Reusable Organizational Knowledge
 *
 * Architectural boundary:
 * - This service is a composition owner, NOT a sixth engine. It calls the five
 *   canonical intelligence engines and never re-implements their math:
 *     - ReasoningEngine            -> evidence-bound reasoning provenance
 *     - OrganizationalIntelligence -> structured diagnosis, process metrics, learning
 *     - GovernanceEngine           -> decision controls, policy, approvals
 *     - ExecutiveIntelligenceEngine-> financial/strategic achievement assessment
 *     - AutonomousOperationsEngine -> controlled action, monitoring, recovery
 * - Problem-case state is persisted through the canonical `SQLitePersistenceStore`
 *   under the tenant scope, so cases survive restart and remain tenant-isolated.
 * - No fabricated AI scores: every number is a real measurement, an engine
 *   classification, or an explicit ratio over real evidence.
 * - Consequential decisions and execution fail closed when governance denies
 *   them or when engine prerequisites are missing.
 */

export type ProblemCaseStage =
    | "OPEN"
    | "DEFINED"
    | "EVIDENCE_SET"
    | "HYPOTHESES_FORMED"
    | "ROOT_CAUSE_IDENTIFIED"
    | "OPTIONS_EVALUATED"
    | "DECISION_PENDING_APPROVAL"
    | "DECIDED"
    | "ACTION_PLANNED"
    | "EXECUTED"
    | "RESOLVED"
    | "LEARNED";

export type ProblemCategory = "PROCESS" | "PEOPLE" | "DATA" | "TECHNOLOGY" | "GOVERNANCE" | "FINANCIAL" | "OTHER";
export type EvidenceCategory = "DELAY" | "RESOURCE" | "QUALITY" | "DUPLICATION" | "PROCESS" | "PEOPLE" | "DATA" | "OTHER";
export type ProblemSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ProblemBlockCode =
    | "problem-tenant-required"
    | "problem-title-required"
    | "problem-scope-required"
    | "problem-not-found"
    | "problem-stage-invalid"
    | "problem-definition-invalid"
    | "problem-evidence-required"
    | "problem-evidence-invalid"
    | "problem-hypotheses-required"
    | "problem-options-invalid"
    | "problem-option-unknown"
    | "problem-governance-denied"
    | "problem-governance-approval-required"
    | "problem-action-plan-invalid"
    | "problem-action-plan-blocked"
    | "problem-execution-blocked"
    | "problem-outcome-invalid"
    | "problem-outcome-tenant-mismatch"
    | "problem-outcome-blocked"
    | "problem-persistence";

export interface ProblemOperationFailure {
    readonly status: "BLOCKED";
    readonly code: ProblemBlockCode;
    readonly reason: string;
}

export interface ProblemOperationSuccess<T> {
    readonly status: "READY";
    readonly value: T;
}

export type ProblemResult<T> = ProblemOperationSuccess<T> | ProblemOperationFailure;

export interface ProblemDefinition {
    readonly statement: string;
    readonly scope: string;
    readonly impactedProcesses: readonly string[];
    readonly ownerId: string;
    readonly successCriteria: readonly string[];
    readonly definedBy: string;
    readonly definedAt: string;
}

export interface ProblemEvidenceItem {
    readonly id: string;
    readonly category: EvidenceCategory;
    readonly summary: string;
    readonly source: string;
    readonly observedAt?: string;
}

export interface ProblemHypothesis {
    readonly id: string;
    readonly statement: string;
    readonly supportingEvidenceIds: readonly string[];
    readonly evidenceCoverage: number;
    readonly status: "SUPPORTED" | "WEAK" | "UNVERIFIED";
}

export interface ProblemRankedCause {
    readonly cause: string;
    readonly support: number;
}

export interface ProblemRootCause {
    readonly primaryCause: string;
    readonly rankedCauses: readonly ProblemRankedCause[];
    readonly affectedProcesses: readonly string[];
    readonly recommendations: readonly string[];
    readonly engineDiagnosisStatus: "READY" | "BLOCKED" | "NEEDS_DATA";
    readonly diagnosisTraceId: string;
}

export interface ProblemOption {
    readonly id: string;
    readonly description: string;
    readonly expectedImpact?: string;
    readonly estimatedCost?: number;
    readonly estimatedRisk?: "LOW" | "MEDIUM" | "HIGH";
}

export interface ProblemOptionEvaluation {
    readonly reasoningTraceId: string;
    readonly reasoningVerificationStatus: "VERIFIED" | "PENDING" | "FAILED";
    readonly scenarioSummary: string;
    readonly ranking?: DecisionWorkbenchResult;
}

export interface ProblemDecision {
    readonly selectedOptionId: string;
    readonly rationale: string;
    readonly decidedBy: string;
    readonly decidedAt: string;
    readonly governanceStatus: "ALLOWED" | "REVIEW_REQUIRED";
    readonly governanceTraceId: string;
    readonly appliedPolicies: readonly string[];
    readonly requiresHumanApproval: boolean;
    readonly humanApprovalRef?: string;
}

export interface ProblemActionPlan {
    readonly objective: string;
    readonly workflowId: string;
    readonly constraints: WorkflowConstraints;
    readonly planStatus: WorkflowPlan["status"];
    readonly steps: readonly { readonly stepId: string; readonly description: string; readonly assignedEngine: string }[];
    readonly traceId: string;
    readonly plannedAt: string;
}

export interface ProblemExecution {
    readonly workflowId: string;
    readonly status: WorkflowExecutionResult["status"];
    readonly complianceStatus: WorkflowExecutionResult["complianceStatus"];
    readonly results: readonly string[];
    readonly monitor?: { readonly status: ExecutionMonitor["status"]; readonly progressPercent: number };
    readonly traceId: string;
    readonly executedAt: string;
}

export interface ProblemOutcome {
    readonly measurement: ImpactMeasurementResult;
    readonly executivePerformance?: { readonly status: string; readonly achievementRate: number };
    readonly outcomeAttainment: number | null;
    readonly actionOutcome: "SUCCESS" | "PARTIAL" | "FAILED";
    readonly learning: LearningRecord;
    readonly traceId: string;
    readonly measuredAt: string;
}

export interface ProblemKnowledgeRecord {
    readonly knowledgeId: string;
    readonly title: string;
    readonly summary: string;
    readonly signature: string;
    readonly reusable: true;
    readonly traceId: string;
    readonly capturedAt: string;
}

export interface ProblemStageRecord {
    readonly stage: ProblemCaseStage;
    readonly at: string;
    readonly actorId: string;
    readonly traceId: string;
    readonly summary: string;
}

export interface ProblemDiagnosisSummary {
    readonly status: "READY" | "BLOCKED" | "NEEDS_DATA";
    readonly rootCauses: readonly string[];
    readonly affectedProcesses: readonly string[];
    readonly recommendations: readonly string[];
    readonly diagnosisTraceId: string;
    readonly reasoningTraceId: string;
    readonly reasoningVerificationStatus: "VERIFIED" | "PENDING" | "FAILED";
}

export interface ProblemCase {
    readonly id: string;
    readonly tenantId: string;
    readonly signature: string;
    readonly title: string;
    readonly scope: string;
    readonly category: ProblemCategory;
    readonly severity: ProblemSeverity;
    readonly description: string;
    readonly createdBy: string;
    readonly createdAt: string;
    readonly stage: ProblemCaseStage;
    readonly definition?: ProblemDefinition;
    readonly evidence: readonly ProblemEvidenceItem[];
    readonly evidenceHash?: string;
    readonly evidenceCompleteness: number;
    readonly hypotheses: readonly ProblemHypothesis[];
    readonly diagnosis?: ProblemDiagnosisSummary;
    readonly rootCause?: ProblemRootCause;
    readonly options: readonly ProblemOption[];
    readonly optionEvaluation?: ProblemOptionEvaluation;
    readonly decision?: ProblemDecision;
    readonly actionPlan?: ProblemActionPlan;
    readonly execution?: ProblemExecution;
    readonly outcome?: ProblemOutcome;
    readonly knowledge?: ProblemKnowledgeRecord;
    readonly stageHistory: readonly ProblemStageRecord[];
    readonly provenance: {
        readonly traceId: string;
        readonly inputHash: string;
        readonly verificationStatus: "VERIFIED" | "PENDING" | "FAILED";
    };
}

export interface ProblemCaseMetrics {
    readonly caseId: string;
    readonly tenantId: string;
    readonly stage: ProblemCaseStage;
    readonly timeToDefinitionMs: number | null;
    readonly diagnosisTimeMs: number | null;
    readonly diagnosisToDecisionMs: number | null;
    readonly decisionToActionMs: number | null;
    readonly timeToResolutionMs: number | null;
    readonly evidenceCompleteness: number;
    readonly recurrenceCount: number;
    readonly actionOutcome: "SUCCESS" | "PARTIAL" | "FAILED" | "PENDING";
    readonly outcomeAttainment: number | null;
    readonly futureResolutionSpeedMs: number | null;
}

export interface OpenProblemInput {
    readonly tenantId: string;
    readonly title: string;
    readonly scope?: string;
    readonly category?: ProblemCategory;
    readonly severity?: ProblemSeverity;
    readonly description?: string;
    readonly createdBy: string;
}

export interface DefineProblemInput {
    readonly statement: string;
    readonly scope?: string;
    readonly impactedProcesses?: readonly string[];
    readonly ownerId?: string;
    readonly successCriteria?: readonly string[];
}

export interface ProblemEvaluationInput {
    readonly criteria: DecisionWorkbenchInput["criteria"];
    readonly scores: readonly (readonly number[])[];
    readonly pairwiseMatrix?: readonly (readonly number[])[];
}

export interface DecideProblemInput {
    readonly selectedOptionId: string;
    readonly rationale: string;
    readonly humanApprovalRef?: string;
}

export interface PlanActionsInput {
    readonly objective: string;
    readonly steps: readonly string[];
    readonly requiredApprovals: readonly string[];
    readonly maxDuration?: number;
    readonly maxBudget?: number;
}

export interface MeasureOutcomeInput {
    readonly baseline: BaselineMetrics;
    readonly post: PostInterventionMetrics;
    readonly expected?: ExpectedImpact;
}

const CAPABILITY_ID = "product.organizational-problem-solving";
const CASE_PREFIX = "problem-case:";
const INDEX_KEY = "problem-case-index";
const REQUIRED_EVIDENCE_CATEGORIES: readonly EvidenceCategory[] = Object.freeze(["PROCESS", "PEOPLE", "DATA"]);

const CATEGORY_BLANK = "OTHER";
const EVIDENCE_TO_DIAGNOSIS_KEY: Record<EvidenceCategory, string> = {
    DELAY: "delay",
    RESOURCE: "resource",
    QUALITY: "quality",
    DUPLICATION: "duplication",
    PROCESS: "process",
    PEOPLE: "people",
    DATA: "data",
    OTHER: "other",
};

const isNonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const nowIso = (): string => new Date().toISOString();

const failure = (code: ProblemBlockCode, reason: string): ProblemOperationFailure => ({ status: "BLOCKED", code, reason });
const success = <T>(value: T): ProblemOperationSuccess<T> => ({ status: "READY", value });

export class OrganizationalProblemSolvingService {
    readonly capabilityId = CAPABILITY_ID;
    readonly targetEngines: readonly string[] = Object.freeze([
        "ReasoningEngine",
        "GovernanceEngine",
        "ExecutiveIntelligenceEngine",
        "OrganizationalIntelligenceEngine",
        "AutonomousOperationsEngine",
    ]);

    private readonly reasoning: ReasoningEngine;
    private readonly orgIntel: OrganizationalIntelligenceEngine;
    private readonly governance: GovernanceEngine;
    private readonly executive: ExecutiveIntelligenceEngine;
    private readonly autoOps: AutonomousOperationsEngine;
    private readonly impact: ImpactMeasurementService;
    private readonly decisionWorkbench: DecisionWorkbench;
    private readonly knowledge: KnowledgeEngine;

    constructor(
        private readonly persistence: SQLitePersistenceStore,
        deps: {
            readonly reasoning?: ReasoningEngine;
            readonly orgIntel?: OrganizationalIntelligenceEngine;
            readonly governance?: GovernanceEngine;
            readonly executive?: ExecutiveIntelligenceEngine;
            readonly autoOps?: AutonomousOperationsEngine;
            readonly impact?: ImpactMeasurementService;
            readonly decisionWorkbench?: DecisionWorkbench;
            readonly knowledge?: KnowledgeEngine;
        } = {},
    ) {
        this.reasoning = deps.reasoning ?? new ReasoningEngine();
        this.orgIntel = deps.orgIntel ?? new OrganizationalIntelligenceEngine();
        this.governance = deps.governance ?? new GovernanceEngine();
        this.executive = deps.executive ?? new ExecutiveIntelligenceEngine();
        this.autoOps = deps.autoOps ?? new AutonomousOperationsEngine();
        this.impact = deps.impact ?? new ImpactMeasurementService();
        this.decisionWorkbench = deps.decisionWorkbench ?? new DecisionWorkbench();
        this.knowledge = deps.knowledge ?? new KnowledgeEngine();
        this.reasoning.initialize();
        this.orgIntel.initialize();
        this.governance.initialize();
        this.executive.initialize();
        this.autoOps.initialize();
        this.knowledge.initialize();
    }

    /** Expose the governance owner so the runtime can install real policies. */
    getGovernanceEngine(): GovernanceEngine {
        return this.governance;
    }

    async openCase(input: OpenProblemInput): Promise<ProblemResult<ProblemCase>> {
        const tenantId = isNonEmpty(input?.tenantId) ? input.tenantId.trim() : "";
        if (!tenantId) return failure("problem-tenant-required", "A tenant is required to open a problem case.");
        if (!isNonEmpty(input?.title)) return failure("problem-title-required", "A problem title is required.");
        if (!isNonEmpty(input?.createdBy)) return failure("problem-definition-invalid", "A creator identity is required.");

        const title = input.title.trim();
        const scope = isNonEmpty(input.scope) ? input.scope.trim() : title;
        const category: ProblemCategory = input.category ?? "OTHER";
        const severity: ProblemSeverity = input.severity ?? "MEDIUM";
        const createdAt = nowIso();
        const traceId = ProvenanceTrace.createTraceId();
        const signature = `${category}::${scope.toLowerCase()}`;

        for (let attempt = 0; attempt < 3; attempt += 1) {
            const id = `PROBLEM-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
            const record: ProblemCase = {
                id,
                tenantId,
                signature,
                title,
                scope,
                category,
                severity,
                description: isNonEmpty(input.description) ? input.description.trim() : "",
                createdBy: input.createdBy,
                createdAt,
                stage: "OPEN",
                evidence: [],
                evidenceCompleteness: 0,
                hypotheses: [],
                options: [],
                stageHistory: [
                    { stage: "OPEN", at: createdAt, actorId: input.createdBy, traceId, summary: `Problem case opened: ${title}` },
                ],
                provenance: {
                    traceId,
                    inputHash: ProvenanceTrace.hashInput(JSON.stringify({ tenantId, title, scope, category, severity })),
                    verificationStatus: "VERIFIED",
                },
            };
            const claimed = await this.persistence.writeIfAbsent({ tenantId }, CASE_PREFIX + id, record);
            if (claimed.created) {
                await this.appendToIndex(tenantId, id);
                return success(record);
            }
        }
        return failure("problem-persistence", "Could not allocate a unique problem-case id.");
    }

    async defineProblem(tenantId: string, caseId: string, actorId: string, definition: DefineProblemInput): Promise<ProblemResult<ProblemCase>> {
        const loaded = await this.requireCase(tenantId, caseId);
        if (loaded.status === "BLOCKED") return loaded;
        const current = loaded.value;
        if (current.stage !== "OPEN") return failure("problem-stage-invalid", `Definition requires stage OPEN, found ${current.stage}.`);
        if (!isNonEmpty(definition?.statement)) return failure("problem-definition-invalid", "A problem statement is required.");

        const impactedProcesses = this.cleanStringArray(definition.impactedProcesses);
        const successCriteria = this.cleanStringArray(definition.successCriteria);
        const scope = isNonEmpty(definition.scope) ? definition.scope.trim() : current.scope;
        const definedAt = nowIso();
        const traceId = ProvenanceTrace.createTraceId();
        const next: ProblemCase = {
            ...current,
            scope,
            signature: `${current.category}::${scope.toLowerCase()}`,
            stage: "DEFINED",
            definition: {
                statement: definition.statement.trim(),
                scope,
                impactedProcesses,
                ownerId: isNonEmpty(definition.ownerId) ? definition.ownerId.trim() : current.createdBy,
                successCriteria,
                definedBy: actorId,
                definedAt,
            },
            stageHistory: [...current.stageHistory, { stage: "DEFINED", at: definedAt, actorId, traceId, summary: `Problem defined: ${definition.statement.trim()}` }],
        };
        return this.commit(next);
    }

    async addEvidence(tenantId: string, caseId: string, actorId: string, items: readonly Omit<ProblemEvidenceItem, "id">[]): Promise<ProblemResult<ProblemCase>> {
        const loaded = await this.requireCase(tenantId, caseId);
        if (loaded.status === "BLOCKED") return loaded;
        const current = loaded.value;
        if (current.stage !== "DEFINED" && current.stage !== "EVIDENCE_SET") {
            return failure("problem-stage-invalid", `Evidence collection requires stage DEFINED, found ${current.stage}.`);
        }
        if (!Array.isArray(items) || items.length === 0) return failure("problem-evidence-required", "At least one evidence item is required.");
        if (items.some((item) => !item || !isNonEmpty(item.summary) || !isNonEmpty(item.source))) {
            return failure("problem-evidence-invalid", "Each evidence item requires a summary and a source.");
        }

        const evidence: ProblemEvidenceItem[] = items.map((item, index) => ({
            id: `EV-${current.id}-${current.evidence.length + index + 1}`,
            category: this.normalizeEvidenceCategory(item.category),
            summary: item.summary.trim(),
            source: item.source.trim(),
            ...(isNonEmpty(item.observedAt) ? { observedAt: item.observedAt } : {}),
        }));
        const combined = [...current.evidence, ...evidence];
        const presentCategories = new Set(combined.map((item) => item.category));
        const evidenceCompleteness = REQUIRED_EVIDENCE_CATEGORIES.filter((category) => presentCategories.has(category)).length / REQUIRED_EVIDENCE_CATEGORIES.length;
        const at = nowIso();
        const traceId = ProvenanceTrace.createTraceId();
        const next: ProblemCase = {
            ...current,
            stage: "EVIDENCE_SET",
            evidence: combined,
            evidenceHash: ProvenanceTrace.hashInput(JSON.stringify(combined)),
            evidenceCompleteness,
            stageHistory: [...current.stageHistory, { stage: "EVIDENCE_SET", at, actorId, traceId, summary: `Recorded ${evidence.length} evidence item(s); ${combined.length} total` }],
        };
        return this.commit(next);
    }

    async formHypotheses(tenantId: string, caseId: string, actorId: string): Promise<ProblemResult<ProblemCase>> {
        const loaded = await this.requireCase(tenantId, caseId);
        if (loaded.status === "BLOCKED") return loaded;
        const current = loaded.value;
        if (current.stage !== "EVIDENCE_SET") return failure("problem-stage-invalid", `Hypothesis formation requires stage EVIDENCE_SET, found ${current.stage}.`);
        if (current.evidence.length === 0) return failure("problem-evidence-required", "Hypotheses require a recorded evidence set.");

        // Real ReasoningEngine handoff: evidence-bound reasoning with provenance.
        const problemText = [
            `Organizational problem: ${current.definition?.statement ?? current.title}`,
            `Scope: ${current.scope}`,
            `Evidence: ${current.evidence.map((item) => `[${item.category}] ${item.summary} (source: ${item.source})`).join(" | ")}`,
        ].join("\n");
        const reasoningResult = this.reasoning.reason(problemText);

        // Real OrganizationalIntelligenceEngine handoff: structured organizational diagnosis.
        const evidenceRecord: Record<string, unknown> = {};
        for (const item of current.evidence) evidenceRecord[EVIDENCE_TO_DIAGNOSIS_KEY[item.category]] = true;
        const diagnosis = this.orgIntel.diagnose(current.scope, evidenceRecord);

        const hypotheses: ProblemHypothesis[] = diagnosis.rootCauses.slice(0, 5).map((cause, index) => {
            const supporting = current.evidence.filter((item) => this.causeMatchesEvidence(cause, item.category));
            const coverage = current.evidence.length > 0 ? supporting.length / current.evidence.length : 0;
            return {
                id: `HYP-${index + 1}`,
                statement: cause,
                supportingEvidenceIds: supporting.map((item) => item.id),
                evidenceCoverage: coverage,
                status: coverage >= 0.5 ? "SUPPORTED" : coverage > 0 ? "WEAK" : "UNVERIFIED",
            };
        });

        const at = nowIso();
        const traceId = ProvenanceTrace.createTraceId();
        const next: ProblemCase = {
            ...current,
            stage: "HYPOTHESES_FORMED",
            hypotheses,
            diagnosis: {
                status: diagnosis.status,
                rootCauses: diagnosis.rootCauses,
                affectedProcesses: diagnosis.affectedProcesses,
                recommendations: diagnosis.recommendations,
                diagnosisTraceId: diagnosis.provenance.traceId,
                reasoningTraceId: reasoningResult.provenance?.traceId ?? traceId,
                reasoningVerificationStatus: reasoningResult.provenance?.verificationStatus ?? "PENDING",
            },
            stageHistory: [...current.stageHistory, { stage: "HYPOTHESES_FORMED", at, actorId, traceId, summary: `Formed ${hypotheses.length} evidence-bound hypotheses (diagnosis ${diagnosis.status})` }],
        };
        return this.commit(next);
    }

    async analyzeRootCause(tenantId: string, caseId: string, actorId: string): Promise<ProblemResult<ProblemCase>> {
        const loaded = await this.requireCase(tenantId, caseId);
        if (loaded.status === "BLOCKED") return loaded;
        const current = loaded.value;
        if (current.stage !== "HYPOTHESES_FORMED") return failure("problem-stage-invalid", `Root-cause analysis requires stage HYPOTHESES_FORMED, found ${current.stage}.`);
        if (current.hypotheses.length === 0) return failure("problem-hypotheses-required", "Root-cause analysis requires formed hypotheses.");

        const ranked: ProblemRankedCause[] = [...current.hypotheses]
            .map((hypothesis) => ({ cause: hypothesis.statement, support: hypothesis.evidenceCoverage }))
            .sort((a, b) => b.support - a.support);
        const primary = ranked[0];
        const at = nowIso();
        const traceId = ProvenanceTrace.createTraceId();
        const next: ProblemCase = {
            ...current,
            stage: "ROOT_CAUSE_IDENTIFIED",
            rootCause: {
                primaryCause: primary.cause,
                rankedCauses: ranked,
                affectedProcesses: current.diagnosis?.affectedProcesses ?? [],
                recommendations: current.diagnosis?.recommendations ?? [],
                engineDiagnosisStatus: current.diagnosis?.status ?? "NEEDS_DATA",
                diagnosisTraceId: current.diagnosis?.diagnosisTraceId ?? traceId,
            },
            stageHistory: [...current.stageHistory, { stage: "ROOT_CAUSE_IDENTIFIED", at, actorId, traceId, summary: `Primary root cause: ${primary.cause}` }],
        };
        return this.commit(next);
    }

    async evaluateOptions(
        tenantId: string,
        caseId: string,
        actorId: string,
        options: readonly ProblemOption[],
        evaluation?: ProblemEvaluationInput,
    ): Promise<ProblemResult<ProblemCase>> {
        const loaded = await this.requireCase(tenantId, caseId);
        if (loaded.status === "BLOCKED") return loaded;
        const current = loaded.value;
        if (current.stage !== "ROOT_CAUSE_IDENTIFIED") return failure("problem-stage-invalid", `Option evaluation requires stage ROOT_CAUSE_IDENTIFIED, found ${current.stage}.`);
        const cleaned = Array.isArray(options) ? options.filter((option) => option && isNonEmpty(option.id) && isNonEmpty(option.description)) : [];
        if (cleaned.length === 0) return failure("problem-options-invalid", "At least one option with a non-empty id and description is required.");
        if (new Set(cleaned.map((option) => option.id)).size !== cleaned.length) return failure("problem-options-invalid", "Option ids must be unique.");

        // Real ReasoningEngine handoff over the scenario framing.
        const scenarioText = [
            `Root cause: ${current.rootCause?.primaryCause ?? "unknown"}`,
            `Scope: ${current.scope}`,
            `Options: ${cleaned.map((option) => `${option.id}: ${option.description}${option.expectedImpact ? ` (expected: ${option.expectedImpact})` : ""}`).join(" | ")}`,
        ].join("\n");
        const reasoningResult = this.reasoning.reason(scenarioText);

        let ranking: DecisionWorkbenchResult | undefined;
        if (evaluation) {
            const workbenchResult = this.decisionWorkbench.execute({
                tenantId,
                problem: current.definition?.statement ?? current.title,
                alternatives: cleaned.map((option) => option.id),
                criteria: evaluation.criteria,
                scores: evaluation.scores,
                pairwiseMatrix: evaluation.pairwiseMatrix,
            });
            if (workbenchResult.status !== "READY") return failure("problem-options-invalid", "Option scoring could not be evaluated by the canonical decision workbench.");
            ranking = workbenchResult;
        }

        const at = nowIso();
        const traceId = ProvenanceTrace.createTraceId();
        const next: ProblemCase = {
            ...current,
            stage: "OPTIONS_EVALUATED",
            options: cleaned.map((option) => ({
                id: option.id.trim(),
                description: option.description.trim(),
                ...(isNonEmpty(option.expectedImpact) ? { expectedImpact: option.expectedImpact } : {}),
                ...(Number.isFinite(option.estimatedCost) ? { estimatedCost: Number(option.estimatedCost) } : {}),
                ...(option.estimatedRisk ? { estimatedRisk: option.estimatedRisk } : {}),
            })),
            optionEvaluation: {
                reasoningTraceId: reasoningResult.provenance?.traceId ?? traceId,
                reasoningVerificationStatus: reasoningResult.provenance?.verificationStatus ?? "PENDING",
                scenarioSummary: reasoningResult.answer ?? reasoningResult.status,
                ...(ranking ? { ranking } : {}),
            },
            stageHistory: [...current.stageHistory, { stage: "OPTIONS_EVALUATED", at, actorId, traceId, summary: `Evaluated ${cleaned.length} option(s)${ranking ? " with canonical Expert Choice ranking" : ""}` }],
        };
        return this.commit(next);
    }

    async decide(
        tenantId: string,
        caseId: string,
        actorId: string,
        decision: DecideProblemInput,
        securityContext: SecurityContext,
    ): Promise<ProblemResult<ProblemCase>> {
        const loaded = await this.requireCase(tenantId, caseId);
        if (loaded.status === "BLOCKED") return loaded;
        const current = loaded.value;
        if (current.stage !== "OPTIONS_EVALUATED" && current.stage !== "DECISION_PENDING_APPROVAL") {
            return failure("problem-stage-invalid", `Decision requires stage OPTIONS_EVALUATED, found ${current.stage}.`);
        }
        if (!isNonEmpty(decision?.selectedOptionId)) return failure("problem-options-invalid", "A selected option id is required.");
        const option = current.options.find((candidate) => candidate.id === decision.selectedOptionId);
        if (!option) return failure("problem-option-unknown", `Unknown option id: ${decision.selectedOptionId}.`);

        // Real GovernanceEngine handoff: policy, authorization and approval controls.
        const governance = this.governance.evaluate({
            action: "APPROVE_DECISION",
            securityContext,
            target: { tenantId },
            parameters: { problemCaseId: caseId, selectedOptionId: option.id, rationale: decision.rationale },
        });
        if (governance.status === "DENIED") {
            return failure("problem-governance-denied", `Governance denied the decision: ${governance.reasons.join("; ")}`);
        }

        const decidedAt = nowIso();
        const traceId = ProvenanceTrace.createTraceId();
        const needsApproval = governance.status === "REVIEW_REQUIRED" || governance.requiresHumanApproval;
        if (needsApproval && !isNonEmpty(decision.humanApprovalRef)) {
            const pending: ProblemCase = {
                ...current,
                stage: "DECISION_PENDING_APPROVAL",
                stageHistory: [...current.stageHistory, { stage: "DECISION_PENDING_APPROVAL", at: decidedAt, actorId, traceId, summary: `Decision on ${option.id} requires human approval (${governance.appliedPolicies.join(", ") || "policy"})` }],
            };
            await this.commit(pending);
            return failure("problem-governance-approval-required", "Governance requires human approval before this decision can be finalized.");
        }

        const next: ProblemCase = {
            ...current,
            stage: "DECIDED",
            decision: {
                selectedOptionId: option.id,
                rationale: isNonEmpty(decision.rationale) ? decision.rationale.trim() : option.description,
                decidedBy: actorId,
                decidedAt,
                governanceStatus: governance.status === "ALLOWED" ? "ALLOWED" : "REVIEW_REQUIRED",
                governanceTraceId: governance.traceId,
                appliedPolicies: governance.appliedPolicies,
                requiresHumanApproval: needsApproval,
                ...(isNonEmpty(decision.humanApprovalRef) ? { humanApprovalRef: decision.humanApprovalRef.trim() } : {}),
            },
            stageHistory: [...current.stageHistory, { stage: "DECIDED", at: decidedAt, actorId, traceId, summary: `Decision recorded for option ${option.id}` }],
        };
        return this.commit(next);
    }

    async planActions(tenantId: string, caseId: string, actorId: string, plan: PlanActionsInput): Promise<ProblemResult<ProblemCase>> {
        const loaded = await this.requireCase(tenantId, caseId);
        if (loaded.status === "BLOCKED") return loaded;
        const current = loaded.value;
        if (current.stage !== "DECIDED") return failure("problem-stage-invalid", `Action planning requires stage DECIDED, found ${current.stage}.`);
        if (!isNonEmpty(plan?.objective)) return failure("problem-action-plan-invalid", "An action-plan objective is required.");
        const steps = this.cleanStringArray(plan.steps);
        if (steps.length === 0) return failure("problem-action-plan-invalid", "At least one action step is required.");
        const requiredApprovals = this.cleanStringArray(plan.requiredApprovals);
        if (requiredApprovals.length === 0) return failure("problem-action-plan-invalid", "Required approvals must be declared for governed execution.");

        const constraints: WorkflowConstraints = {
            ...(Number.isFinite(plan.maxDuration) ? { maxDuration: Number(plan.maxDuration) } : {}),
            ...(Number.isFinite(plan.maxBudget) ? { maxBudget: Number(plan.maxBudget) } : {}),
            requiredApprovals,
        };

        // Real AutonomousOperationsEngine handoff: governed workflow planning.
        const workflow = this.autoOps.planWorkflow(plan.objective.trim(), constraints);
        if (workflow.status !== "READY") return failure("problem-action-plan-blocked", `Autonomous operations could not plan the workflow: ${workflow.workflowId}.`);

        const at = nowIso();
        const traceId = ProvenanceTrace.createTraceId();
        const next: ProblemCase = {
            ...current,
            stage: "ACTION_PLANNED",
            actionPlan: {
                objective: plan.objective.trim(),
                workflowId: workflow.workflowId,
                constraints,
                planStatus: workflow.status,
                steps: workflow.steps.map((step) => ({ stepId: step.stepId, description: step.description, assignedEngine: step.assignedEngine })),
                traceId: workflow.provenance.traceId,
                plannedAt: at,
            },
            stageHistory: [...current.stageHistory, { stage: "ACTION_PLANNED", at, actorId, traceId, summary: `Action plan created (workflow ${workflow.workflowId}) with ${workflow.steps.length} steps` }],
        };
        return this.commit(next);
    }

    async executeActions(tenantId: string, caseId: string, actorId: string, securityContext: SecurityContext): Promise<ProblemResult<ProblemCase>> {
        const loaded = await this.requireCase(tenantId, caseId);
        if (loaded.status === "BLOCKED") return loaded;
        const current = loaded.value;
        if (current.stage !== "ACTION_PLANNED") return failure("problem-stage-invalid", `Execution requires stage ACTION_PLANNED, found ${current.stage}.`);
        const plan = current.actionPlan;
        if (!plan) return failure("problem-action-plan-invalid", "No action plan is recorded.");

        const at = nowIso();
        const traceId = ProvenanceTrace.createTraceId();

        // Governed activation: the caller must hold EXECUTE authority within the
        // case tenant, and the controlled action is attributed to an explicit
        // autonomous-operation principal (never an anonymous actor).
        if (securityContext?.tenantId !== tenantId) {
            return failure("problem-execution-blocked", "Execution requires a security context scoped to the case tenant.");
        }
        if (!securityContext.permissions?.includes(Authorization.EXECUTE)) {
            return failure("problem-execution-blocked", "Execution requires EXECUTE authority.");
        }
        const autonomousContext = SecurityContext.forAutonomousOperation(
            Principal.autonomousOperation(`${this.capabilityId}:${caseId}`, "AutonomousDaemon", tenantId),
            traceId,
        );

        // Real AutonomousOperationsEngine handoff: authorized execution + monitoring.
        // Execution authority is already enforced above (EXECUTE + tenant scope), so
        // a BLOCKED result means the engine's in-memory workflow registry no longer
        // holds the plan (process restart). Recover deterministically by re-planning
        // from the persisted objective/constraints, then execute the reconstruction.
        let workflowId = plan.workflowId;
        let execution = this.autoOps.executeAuthorizedWorkflow(workflowId, autonomousContext);
        if (execution.status === "BLOCKED") {
            const replanned = this.autoOps.planWorkflow(plan.objective, plan.constraints);
            if (replanned.status !== "READY") return failure("problem-execution-blocked", "Action plan could not be recovered after restart.");
            workflowId = replanned.workflowId;
            execution = this.autoOps.executeAuthorizedWorkflow(workflowId, autonomousContext);
        }
        if (execution.status !== "EXECUTED" || execution.complianceStatus === "NON_COMPLIANT") {
            return failure("problem-execution-blocked", `Autonomous execution did not complete: ${execution.status}/${execution.complianceStatus}.`);
        }
        const monitor = this.autoOps.monitorExecution(workflowId);
        const next: ProblemCase = {
            ...current,
            stage: "EXECUTED",
            actionPlan: { ...plan, workflowId },
            execution: {
                workflowId,
                status: execution.status,
                complianceStatus: execution.complianceStatus,
                results: execution.results,
                monitor: { status: monitor.status, progressPercent: monitor.progressPercent },
                traceId: execution.provenance.traceId,
                executedAt: at,
            },
            stageHistory: [...current.stageHistory, { stage: "EXECUTED", at, actorId, traceId, summary: `Executed workflow ${workflowId} (${execution.complianceStatus})` }],
        };
        return this.commit(next);
    }

    async measureOutcome(tenantId: string, caseId: string, actorId: string, input: MeasureOutcomeInput): Promise<ProblemResult<ProblemCase>> {
        const loaded = await this.requireCase(tenantId, caseId);
        if (loaded.status === "BLOCKED") return loaded;
        const current = loaded.value;
        if (current.stage !== "EXECUTED") return failure("problem-stage-invalid", `Outcome measurement requires stage EXECUTED, found ${current.stage}.`);
        if (!input?.baseline || !input?.post) return failure("problem-outcome-invalid", "Baseline and post-intervention metrics are required.");
        if (input.baseline.tenantId !== tenantId || input.post.tenantId !== tenantId) {
            return failure("problem-outcome-tenant-mismatch", "Outcome metrics must belong to the case tenant.");
        }

        // Real ImpactMeasurementService handoff (Executive Intelligence boundary).
        const measurement = this.impact.measure(input.baseline, input.post, input.expected);
        if (measurement.status !== "READY") return failure("problem-outcome-blocked", "Impact measurement could not be computed from the supplied metrics.");

        // Real OrganizationalIntelligenceEngine handoff: organizational learning record.
        const before: ProcessMetrics = {
            cycleTime: input.baseline.cycleTime,
            throughput: input.baseline.throughput,
            errorRate: input.baseline.errorRate,
            capacity: input.baseline.capacity,
            cost: input.baseline.operatingCost,
        };
        const after: ProcessMetrics = {
            cycleTime: input.post.cycleTime,
            throughput: input.post.throughput,
            errorRate: input.post.errorRate,
            capacity: input.post.capacity,
            cost: input.post.operatingCost,
        };
        const learning = this.orgIntel.learnFromExecution(before, after);

        // Real ExecutiveIntelligenceEngine handoff when a financial target exists.
        const executivePerformance = input.expected && input.expected.financialValue > 0
            ? this.executive.evaluatePerformance(measurement.actualImpact.actualFinancialValue, input.expected.financialValue)
            : undefined;
        const outcomeAttainment = input.expected && input.expected.financialValue > 0
            ? measurement.actualImpact.actualFinancialValue / input.expected.financialValue
            : null;
        const actionOutcome: ProblemOutcome["actionOutcome"] = learning.sustainability === "SUSTAINABLE"
            ? "SUCCESS"
            : learning.sustainability === "PARTIAL"
                ? "PARTIAL"
                : "FAILED";

        const at = nowIso();
        const traceId = ProvenanceTrace.createTraceId();
        const next: ProblemCase = {
            ...current,
            stage: "RESOLVED",
            outcome: {
                measurement,
                ...(executivePerformance ? { executivePerformance: { status: executivePerformance.status, achievementRate: executivePerformance.achievementRate } } : {}),
                outcomeAttainment,
                actionOutcome,
                learning,
                traceId,
                measuredAt: at,
            },
            stageHistory: [...current.stageHistory, { stage: "RESOLVED", at, actorId, traceId, summary: `Outcome measured: ${actionOutcome} (sustainability ${learning.sustainability})` }],
        };
        return this.commit(next);
    }

    async captureLearning(tenantId: string, caseId: string, actorId: string): Promise<ProblemResult<ProblemCase>> {
        const loaded = await this.requireCase(tenantId, caseId);
        if (loaded.status === "BLOCKED") return loaded;
        const current = loaded.value;
        if (current.stage !== "RESOLVED") return failure("problem-stage-invalid", `Learning capture requires stage RESOLVED, found ${current.stage}.`);
        const outcome = current.outcome;
        if (!outcome) return failure("problem-outcome-invalid", "No measured outcome is recorded.");

        // Real KnowledgeEngine handoff: durable, reusable organizational knowledge.
        const summary = [
            `Problem: ${current.title}`,
            `Root cause: ${current.rootCause?.primaryCause ?? "unknown"}`,
            `Decision: ${current.decision?.selectedOptionId ?? "none"}`,
            `Outcome: ${outcome.actionOutcome}`,
            `Learning: cycleTime -${outcome.learning.cycleTimeReduced}, errorRate -${outcome.learning.errorRateReduced}, ROI ${outcome.learning.actualROI}`,
        ].join(" | ");
        const event = new MemoryEvent(`ORGANIZATIONAL_PROBLEM_RESOLVED:${current.signature}`, JSON.stringify({ caseId: current.id, summary }), this.capabilityId, tenantId);
        const knowledge = this.knowledge.learn(event, tenantId);

        const at = nowIso();
        const traceId = ProvenanceTrace.createTraceId();
        const next: ProblemCase = {
            ...current,
            stage: "LEARNED",
            knowledge: {
                knowledgeId: knowledge.id,
                title: `Resolved: ${current.title}`,
                summary,
                signature: current.signature,
                reusable: true,
                traceId,
                capturedAt: at,
            },
            stageHistory: [...current.stageHistory, { stage: "LEARNED", at, actorId, traceId, summary: `Reusable knowledge captured (${knowledge.id})` }],
        };
        return this.commit(next);
    }

    async getCase(tenantId: string, caseId: string): Promise<ProblemCase | null> {
        if (!isNonEmpty(tenantId) || !isNonEmpty(caseId)) return null;
        const record = await this.persistence.read({ tenantId }, CASE_PREFIX + caseId);
        const value = record?.value as ProblemCase | undefined;
        if (!value || value.tenantId !== tenantId) return null;
        return value;
    }

    async listCases(tenantId: string, limit: number, offset: number): Promise<{ readonly cases: readonly ProblemCase[]; readonly total: number }> {
        if (!isNonEmpty(tenantId)) return { cases: [], total: 0 };
        const indexRecord = await this.persistence.read({ tenantId }, INDEX_KEY);
        const ids = Array.isArray((indexRecord?.value as { ids?: unknown })?.ids) ? (indexRecord!.value as { ids: string[] }).ids : [];
        const cases: ProblemCase[] = [];
        for (const id of ids) {
            const record = await this.persistence.read({ tenantId }, CASE_PREFIX + id);
            const value = record?.value as ProblemCase | undefined;
            if (value && value.tenantId === tenantId) cases.push(value);
        }
        const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 50;
        const safeOffset = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
        const sorted = cases.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
        return { cases: sorted.slice(safeOffset, safeOffset + safeLimit), total: sorted.length };
    }

    async getMetrics(tenantId: string, caseId: string): Promise<ProblemCaseMetrics | null> {
        const current = await this.getCase(tenantId, caseId);
        if (!current) return null;
        const all = await this.listCases(tenantId, 200, 0);
        return this.computeMetrics(current, all.cases.filter((candidate) => candidate.id !== current.id));
    }

    private async requireCase(tenantId: string, caseId: string): Promise<ProblemOperationSuccess<ProblemCase> | ProblemOperationFailure> {
        if (!isNonEmpty(tenantId)) return failure("problem-tenant-required", "A tenant is required.");
        if (!isNonEmpty(caseId)) return failure("problem-not-found", "A problem-case id is required.");
        const current = await this.getCase(tenantId, caseId);
        if (!current) return failure("problem-not-found", `Problem case not found: ${caseId}.`);
        return success(current);
    }

    private async commit(next: ProblemCase): Promise<ProblemResult<ProblemCase>> {
        await this.persistence.write({ tenantId: next.tenantId }, CASE_PREFIX + next.id, next);
        await this.appendToIndex(next.tenantId, next.id);
        return success(next);
    }

    private async appendToIndex(tenantId: string, caseId: string): Promise<void> {
        const indexRecord = await this.persistence.read({ tenantId }, INDEX_KEY);
        const ids = Array.isArray((indexRecord?.value as { ids?: unknown })?.ids) ? [...(indexRecord!.value as { ids: string[] }).ids] : [];
        if (!ids.includes(caseId)) {
            ids.push(caseId);
            await this.persistence.write({ tenantId }, INDEX_KEY, { ids });
        }
    }

    private computeMetrics(current: ProblemCase, others: readonly ProblemCase[]): ProblemCaseMetrics {
        const at = (stage: ProblemCaseStage): number | null => {
            const record = current.stageHistory.find((entry) => entry.stage === stage);
            return record ? Date.parse(record.at) : null;
        };
        const createdAt = Date.parse(current.createdAt);
        const definedAt = at("DEFINED");
        const evidenceAt = at("EVIDENCE_SET");
        const rootCauseAt = at("ROOT_CAUSE_IDENTIFIED");
        const decidedAt = at("DECIDED");
        const plannedAt = at("ACTION_PLANNED");
        const resolvedAt = at("RESOLVED");

        const sameSignature = others.filter((candidate) => candidate.signature === current.signature);
        const resolvedSame = sameSignature.filter((candidate) => candidate.stage === "RESOLVED" || candidate.stage === "LEARNED");
        const resolutionDurations = resolvedSame
            .map((candidate) => {
                const end = candidate.stageHistory.find((entry) => entry.stage === "RESOLVED");
                return end ? Date.parse(end.at) - Date.parse(candidate.createdAt) : null;
            })
            .filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0);

        return {
            caseId: current.id,
            tenantId: current.tenantId,
            stage: current.stage,
            timeToDefinitionMs: definedAt !== null ? definedAt - createdAt : null,
            diagnosisTimeMs: rootCauseAt !== null && evidenceAt !== null ? rootCauseAt - evidenceAt : null,
            diagnosisToDecisionMs: decidedAt !== null && rootCauseAt !== null ? decidedAt - rootCauseAt : null,
            decisionToActionMs: plannedAt !== null && decidedAt !== null ? plannedAt - decidedAt : null,
            timeToResolutionMs: resolvedAt !== null ? resolvedAt - createdAt : null,
            evidenceCompleteness: current.evidenceCompleteness,
            recurrenceCount: sameSignature.length,
            actionOutcome: current.outcome?.actionOutcome ?? "PENDING",
            outcomeAttainment: current.outcome?.outcomeAttainment ?? null,
            futureResolutionSpeedMs: resolutionDurations.length > 0
                ? resolutionDurations.reduce((sum, value) => sum + value, 0) / resolutionDurations.length
                : null,
        };
    }

    private normalizeEvidenceCategory(category: unknown): EvidenceCategory {
        const candidate = typeof category === "string" ? category.toUpperCase() : CATEGORY_BLANK;
        const allowed: readonly EvidenceCategory[] = ["DELAY", "RESOURCE", "QUALITY", "DUPLICATION", "PROCESS", "PEOPLE", "DATA", "OTHER"];
        return (allowed as readonly string[]).includes(candidate) ? (candidate as EvidenceCategory) : "OTHER";
    }

    private causeMatchesEvidence(cause: string, category: EvidenceCategory): boolean {
        const lower = cause.toLowerCase();
        if (lower.includes("delay")) return category === "DELAY";
        if (lower.includes("resource")) return category === "RESOURCE";
        if (lower.includes("quality")) return category === "QUALITY";
        if (lower.includes("duplicat")) return category === "DUPLICATION";
        if (lower.includes("people") || lower.includes("staff") || lower.includes("skill")) return category === "PEOPLE";
        if (lower.includes("data")) return category === "DATA";
        if (lower.includes("process") || lower.includes("workflow")) return category === "PROCESS";
        return true;
    }

    private cleanStringArray(values: readonly unknown[] | undefined): string[] {
        if (!Array.isArray(values)) return [];
        return values.map((value) => String(value).trim()).filter((value) => value.length > 0);
    }
}
