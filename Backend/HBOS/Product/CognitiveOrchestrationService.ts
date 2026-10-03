/**
 * product.cognitive-orchestration — B-03 live cognitive orchestration.
 *
 * This module is a COMPOSITION over the existing canonical Engines. It is NOT
 * an Engine, NOT a new cognitive core, and NOT an owner of any domain logic:
 *
 *   - `FinancialIntelligenceEngine` remains the owner of canonical financial
 *     mathematics. This module only *calls* it and *verifies* its output against
 *     the canonical statement insight. It never re-computes a ratio and never
 *     reconstructs a financial value: the total-expense basis is CONSUMED from
 *     the insight's canonical `derivedResidual`, and when that residual is absent
 *     the capability is reported `UNAVAILABLE` (B-03.1).
 *   - `RiskIntelligenceEngine` and `ExecutiveIntelligenceEngine` remain the
 *     owners of risk scoring and executive synthesis. When the canonical record
 *     carries no input they could honestly accept, this module reports them
 *     `UNAVAILABLE` — it does not hold an instance in order to look wired, and
 *     it never fabricates the missing input to force execution.
 *   - `OrganizationalIntelligenceEngine` remains the owner of organizational
 *     intelligence, and is only invoked with GENUINE organizational evidence.
 *     A financial statement carries none: financial ratios, cash flow and
 *     accounting integrity are financial evidence and are never re-labelled as
 *     organizational evidence (B-03.1).
 *   - `GovernanceEngine` remains the owner of policy / authorization.
 *   - `IntelligenceEngine` remains the sanctioned reasoning-pipeline composer.
 *   - `GovernedLearningLifecycle` (B-05) remains the single governed learning
 *     authority. It is an optional PRODUCT SERVICE dependency, not an Engine, and
 *     it is only ever READ here. Learning reaches reasoning as low-confidence
 *     contextual knowledge after it has passed its own evidence, measurement,
 *     governance, versioning and tenant gates; fresh canonical evidence always
 *     outranks it (B-05.2).
 *
 * The user question is the control variable: `analyzeQuestion()` produces the
 * `QuestionIntent`, and the intent selects WHICH capabilities execute. Two
 * different questions over the SAME document therefore execute DIFFERENT
 * capability sets, not merely different headings.
 *
 * Honest-absence contract: a capability whose canonical owner cannot be executed
 * from the available verified evidence is reported `UNAVAILABLE` with a reason.
 * The module never fabricates a capability result to fill a gap.
 */
import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";
import { OrganizationalIntelligenceEngine } from "../Engines/OrganizationalIntelligenceEngine";
import { GovernanceEngine, type GovernanceResult } from "../Engines/GovernanceEngine";
import { IntelligenceEngine } from "../Engines/IntelligenceEngine";
import type { IntelligenceContext, IntelligenceInput } from "../Core/IntelligenceContract";
import { ProvenanceTrace } from "../Core/ProvenanceTrace";
import { MemoryEngine } from "../Core/MemoryEngine";
import type { MemoryEvent } from "../Core/MemoryEvent";
import type { GovernedLearningLifecycle, LearningArtifact } from "./GovernedLearningLifecycle";
import type { SecurityContext } from "../Security/SecurityContext";
import { composeScenarios, analyzeQuestion, type QuestionIntent } from "./FinancialDecisionNarrativeService";
import type { FinancialStatementInsight } from "./FinancialStatementInsight";
import type { OrganizationalProblemSolvingService } from "./OrganizationalProblemSolvingService";
import type { DecisionWorkbench } from "./DecisionWorkbench";
import type { AutonomousOperationsEngine } from "../Engines/AutonomousOperationsEngine";
import type { ExecutiveIntelligenceWorkbench } from "./ExecutiveIntelligenceWorkbench";

/** Canonical capability identifiers selected by the question intent. */
export type CognitiveCapability =
  | "FINANCIAL_INTELLIGENCE"
  | "LIQUIDITY_LEVERAGE"
  | "WORKING_CAPITAL"
  | "EARNINGS_QUALITY"
  | "COMPARATIVE_EVIDENCE"
  | "INTEGRITY_EVIDENCE"
  | "PRODUCT_SEGMENT"
  | "SCENARIO"
  | "EXECUTIVE_INTELLIGENCE"
  | "RISK_INTELLIGENCE"
  | "ORGANIZATIONAL_INTELLIGENCE"
  | "ACTION_FINDINGS"
  | "DECISION_INTELLIGENCE"
  | "GOVERNANCE"
  | "REASONING"
  | "ORGANIZATIONAL_PROBLEM_SOLVING"
  | "DECISION_WORKBENCH"
  | "AUTONOMOUS_OPERATIONS"
  | "EXECUTIVE_WORKBENCH";

export type CapabilityStatus = "EXECUTED" | "UNAVAILABLE" | "NOT_REQUIRED";

export interface CapabilityExecution {
  readonly capability: CognitiveCapability;
  /** The canonical owner that executed (or would own) this capability. */
  readonly owner: string;
  readonly status: CapabilityStatus;
  /** Present when the capability could not be executed from verified evidence. */
  readonly unavailableReason?: string;
  /** Present when the capability is not applicable to this question. */
  readonly notRequiredReason?: string;
  /** Evidence references consumed by this capability. */
  readonly evidence: readonly string[];
  /** Verified structured output (no values beyond the canonical owners). */
  readonly result: Readonly<Record<string, unknown>>;
}

export interface CognitiveContradiction {
  readonly subject: string;
  readonly canonicalValue: number;
  readonly specialistValue: number;
  readonly difference: number;
  /** Canonical deterministic value always wins; the disagreement is surfaced. */
  readonly resolution: "CANONICAL_WINS";
  readonly note: string;
}

/** A disagreement between a historical memory assertion and current canonical evidence. */
export interface CognitiveMemoryConflict {
  readonly subject: string;
  readonly memoryValue: number;
  readonly canonicalValue: number;
  readonly difference: number;
  /** Current canonical evidence is authoritative; memory is preserved as context. */
  readonly resolution: "CANONICAL_WINS";
  readonly memoryRef: string;
  readonly note: string;
}

/**
 * Runtime provenance proving that tenant-scoped cognitive memory retrieval
 * occurred. It exposes the tenant used, how many records were retrieved, the
 * opaque references considered, the preserved trace id, and the fact that
 * current verified evidence stayed authoritative. Internal references are never
 * surfaced into the user-facing Persian answer.
 */
export interface CognitiveMemoryProvenance {
  readonly retrievalOccurred: boolean;
  readonly tenantId: string | null;
  readonly retrievedCount: number;
  readonly references: readonly string[];
  readonly traceId: string;
  readonly authoritativeSource: "CURRENT_CANONICAL_EVIDENCE";
  readonly conflicts: readonly CognitiveMemoryConflict[];
}

/**
 * Memory records that assert a canonical financial fact use this event type.
 * Their `data` is a JSON object mapping canonical subject → numeric value.
 */
export const COGNITIVE_MEMORY_ASSERTION_TYPE = "COGNITIVE_FINANCIAL_ASSERTION";

interface MemoryAssertion {
  readonly subject: string;
  readonly value: number;
}

const memoryAssertions = (event: MemoryEvent): readonly MemoryAssertion[] => {
  if (!event || event.type !== COGNITIVE_MEMORY_ASSERTION_TYPE) return [];
  try {
    const parsed: unknown = JSON.parse(event.data);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    const assertions: MemoryAssertion[] = [];
    for (const [subject, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value)) assertions.push({ subject, value });
    }
    return assertions;
  } catch {
    return [];
  }
};

const canonicalMemorySubject = (
  canonical: { netProfit: number | null; revenue: number | null; totalAssets: number | null; totalLiabilities: number | null },
  subject: string,
): number | null => {
  switch (subject) {
    case "netProfit": return canonical.netProfit;
    case "revenue": return canonical.revenue;
    case "totalAssets": return canonical.totalAssets;
    case "totalLiabilities": return canonical.totalLiabilities;
    default: return null;
  }
};

/**
 * A disagreement between a governed learning artifact and fresh canonical
 * evidence. The artifact is preserved; the canonical value is never overwritten,
 * averaged or merged.
 */
export interface CognitiveLearningConflict {
  readonly subject: string;
  readonly learnedValue: number;
  readonly canonicalValue: number;
  readonly difference: number;
  /** Fresh canonical evidence is authoritative; learning stays as context. */
  readonly resolution: "CANONICAL_WINS";
  readonly artifactRef: string;
  readonly artifactVersion: number;
  readonly note: string;
}

/**
 * B-05 provenance proving that tenant-scoped governed-learning retrieval
 * occurred inside the live cognitive path. It exposes the tenant used, how many
 * eligible artifacts were retrieved, their references and active versions, the
 * preserved trace id, and the fact that current canonical evidence stayed
 * authoritative. Internal references never reach the Persian user answer.
 */
export interface GovernedLearningProvenance {
  readonly retrievalOccurred: boolean;
  readonly tenantId: string | null;
  readonly retrievedCount: number;
  readonly artifactRefs: readonly string[];
  readonly activeVersions: readonly number[];
  readonly traceId: string;
  readonly authoritativeSource: "CURRENT_CANONICAL_EVIDENCE";
  readonly contradictions: readonly CognitiveLearningConflict[];
}

/** A learned canonical assertion carried by an artifact statement. */
interface LearningAssertion {
  readonly subject: string;
  readonly value: number;
}

/**
 * A governed learning artifact may assert a canonical financial fact. Such an
 * assertion is carried as a JSON object mapping canonical subject → numeric
 * value in the artifact statement, exactly as a memory assertion is carried in
 * its record data. A prose statement carries no assertion and therefore can
 * never conflict.
 */
const learningAssertions = (artifact: LearningArtifact): readonly LearningAssertion[] => {
  if (!artifact || typeof artifact.statement !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(artifact.statement);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    const assertions: LearningAssertion[] = [];
    for (const [subject, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value)) assertions.push({ subject, value });
    }
    return assertions;
  } catch {
    return [];
  }
};

export interface CognitiveOrchestrationInput {
  readonly tenantId: string;
  readonly question: string;
  readonly insight: FinancialStatementInsight | null;
  /** Existing executive workbench result, when the runtime already has one. */
  readonly executiveWorkbench?: { readonly recommendations: readonly { readonly action: string }[] } | null;
  /** Existing organizational problem-solving cases for this tenant. */
  readonly problemCases?: readonly { readonly problemId: string; readonly title: string; readonly stage: string; readonly category: string }[] | null;
  /** Existing decision workbench result for this tenant. */
  readonly decisionWorkbench?: { readonly problem: string; readonly method: string; readonly evaluations: readonly { readonly alternative: string }[] } | null;
  /** Security context used only by the governance gate. */
  readonly securityContext?: SecurityContext;
  /** Executable-engine notes, e.g. current source sha and integrity ids. */
  readonly evidenceRefs?: readonly string[];
}

export interface CognitiveOrchestrationResult {
  readonly tenantId: string;
  readonly question: string;
  readonly intent: QuestionIntent;
  readonly selectedCapabilities: readonly CognitiveCapability[];
  readonly executionOrder: readonly CognitiveCapability[];
    readonly executed: readonly CapabilityExecution[];
    /** Capabilities that genuinely ran, in execution order. */
    readonly executedCapabilities: readonly CognitiveCapability[];
    /** Capabilities that could not honestly run, with their reason. */
    readonly unavailableCapabilities: readonly { readonly capability: CognitiveCapability; readonly owner: string; readonly reason: string }[];
  readonly contradictions: readonly CognitiveContradiction[];
  /** Tenant-scoped cognitive memory retrieval provenance. */
  readonly memory: CognitiveMemoryProvenance;
  /** B-05 tenant-scoped governed-learning retrieval provenance. */
  readonly learning: GovernedLearningProvenance;
  readonly reasoning: {
    readonly status: "EXECUTED" | "UNAVAILABLE";
    readonly conclusion: string | null;
    readonly confidenceSource: string;
    readonly steps: readonly string[];
  };
  readonly limitations: readonly string[];
  readonly traceId: string;
  readonly status: "READY" | "PARTIAL";
}

/**
 * Capability selection contract. This is contract-level selection only: whether
 * a capability can actually execute is decided later from verified evidence,
 * and an inability to execute is reported rather than simulated.
 */
const CAPABILITY_SELECTION: Readonly<Record<QuestionIntent["primaryIntent"], readonly CognitiveCapability[]>> = {
  ANALYZE: ["FINANCIAL_INTELLIGENCE", "LIQUIDITY_LEVERAGE", "INTEGRITY_EVIDENCE", "EXECUTIVE_INTELLIGENCE", "REASONING"],
  RISK: ["FINANCIAL_INTELLIGENCE", "LIQUIDITY_LEVERAGE", "EARNINGS_QUALITY", "RISK_INTELLIGENCE", "REASONING"],
  PROFIT_CHANGE: ["COMPARATIVE_EVIDENCE", "FINANCIAL_INTELLIGENCE", "REASONING"],
  PRODUCT: ["PRODUCT_SEGMENT", "FINANCIAL_INTELLIGENCE", "REASONING"],
  DATA_GAPS: ["INTEGRITY_EVIDENCE", "REASONING"],
  SCENARIOS: ["SCENARIO", "FINANCIAL_INTELLIGENCE", "EXECUTIVE_INTELLIGENCE", "REASONING"],
  GROWTH: ["SCENARIO", "FINANCIAL_INTELLIGENCE", "EXECUTIVE_INTELLIGENCE", "REASONING"],
  RESILIENCE: ["LIQUIDITY_LEVERAGE", "WORKING_CAPITAL", "EARNINGS_QUALITY", "COMPARATIVE_EVIDENCE", "FINANCIAL_INTELLIGENCE", "ORGANIZATIONAL_INTELLIGENCE", "REASONING"],
  ACTION: ["ACTION_FINDINGS", "DECISION_INTELLIGENCE", "GOVERNANCE", "REASONING"],
  GENERAL: ["FINANCIAL_INTELLIGENCE", "EXECUTIVE_INTELLIGENCE", "REASONING"],
  ORGANIZATIONAL: ["ORGANIZATIONAL_PROBLEM_SOLVING", "ORGANIZATIONAL_INTELLIGENCE", "REASONING"],
  DECISION: ["DECISION_WORKBENCH", "DECISION_INTELLIGENCE", "GOVERNANCE", "REASONING"],
  OPERATIONAL: ["AUTONOMOUS_OPERATIONS", "REASONING"],
  EXECUTION: ["AUTONOMOUS_OPERATIONS", "GOVERNANCE", "REASONING"],
};

/**
 * Canonical execution order (dependency law):
 * 1. canonical evidence  2. deterministic domain analysis
 * 3. specialist engines  4. decision analysis  5. reasoning
 * 6. governance          7. user-facing composition (outside this module)
 *
 * Reasoning therefore never runs before deterministic truth, and presentation
 * never runs before evidence validation.
 */
const EXECUTION_ORDER: readonly CognitiveCapability[] = [
  "COMPARATIVE_EVIDENCE",
  "INTEGRITY_EVIDENCE",
  "PRODUCT_SEGMENT",
  "SCENARIO",
  "ACTION_FINDINGS",
  "FINANCIAL_INTELLIGENCE",
  "LIQUIDITY_LEVERAGE",
  "WORKING_CAPITAL",
  "EARNINGS_QUALITY",
  "RISK_INTELLIGENCE",
  "ORGANIZATIONAL_INTELLIGENCE",
  "ORGANIZATIONAL_PROBLEM_SOLVING",
  "DECISION_WORKBENCH",
  "AUTONOMOUS_OPERATIONS",
  "EXECUTIVE_INTELLIGENCE",
  "EXECUTIVE_WORKBENCH",
  "DECISION_INTELLIGENCE",
  "REASONING",
  "GOVERNANCE",
];

const metric = (insight: FinancialStatementInsight | null, key: string): number | null => {
  if (!insight) return null;
  const value = insight.metrics?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

/** Relative comparison that tolerates float noise but catches real divergence. */
const agrees = (a: number, b: number, tolerance = 1e-6): boolean => {
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= tolerance * scale;
};

/** Canonical derived values owned by the statement insight. */
const canonicalFinancialValues = (insight: FinancialStatementInsight | null) => ({
  netProfit: metric(insight, "netProfit"),
  revenue: metric(insight, "revenue"),
  debtRatio: insight?.ratios?.debtToAssets ?? null,
  netMargin: insight?.ratios?.netMargin ?? null,
});

export class CognitiveOrchestrationService {
    private readonly financial: FinancialIntelligenceEngine;
    private readonly organizational: OrganizationalIntelligenceEngine;
    private readonly governance: GovernanceEngine;
    private readonly intelligence: IntelligenceEngine;
    /** Canonical tenant-safe cognitive memory owner (never wrapped or copied). */
    private readonly memory: MemoryEngine;
    /**
     * B-05 canonical governed learning owner. It is a PRODUCT SERVICE, not an
     * Engine, and it is optional: a caller that does not supply one keeps the
     * exact previous behaviour.
     */
    private readonly learning?: GovernedLearningLifecycle;
    /**
     * C-01.2: Optional product services for non-financial capability execution.
     * These are only invoked when their evidence contracts are satisfied.
     */
    private readonly problemSolving?: OrganizationalProblemSolvingService;
    private readonly decisionWorkbench?: DecisionWorkbench;
    private readonly autonomousOps?: AutonomousOperationsEngine;
    private readonly executiveWorkbench?: ExecutiveIntelligenceWorkbench;

    constructor(
        financial?: FinancialIntelligenceEngine,
        organizational?: OrganizationalIntelligenceEngine,
        governance?: GovernanceEngine,
        intelligence?: IntelligenceEngine,
        memory?: MemoryEngine,
        learning?: GovernedLearningLifecycle,
        problemSolving?: OrganizationalProblemSolvingService,
        decisionWorkbench?: DecisionWorkbench,
        autonomousOps?: AutonomousOperationsEngine,
        executiveWorkbench?: ExecutiveIntelligenceWorkbench,
    ) {
        this.financial = financial ?? new FinancialIntelligenceEngine();
        this.organizational = organizational ?? new OrganizationalIntelligenceEngine();
        this.governance = governance ?? new GovernanceEngine();
        this.intelligence = intelligence ?? new IntelligenceEngine();
        this.memory = memory ?? new MemoryEngine();
        this.learning = learning;
        this.problemSolving = problemSolving;
        this.decisionWorkbench = decisionWorkbench;
        this.autonomousOps = autonomousOps;
        this.executiveWorkbench = executiveWorkbench;
    }

    orchestrate(input: CognitiveOrchestrationInput): CognitiveOrchestrationResult {
        this.collectedLimitations = [];
        this.retrievedMemory = [];
        this.retrievedLearning = [];
        const question = String(input?.question ?? "");
        const tenantId = String(input?.tenantId ?? "");
        const insight = input?.insight ?? null;
        const intent = analyzeQuestion(question);
        const traceId = ProvenanceTrace.createTraceId();

        // ---- capability selection: the question decides what runs ----------
        const intents = intent.answerMode === "COMPOSITE"
            ? [intent.primaryIntent, ...intent.secondaryIntents]
            : [intent.primaryIntent];
        const selected = new Set<CognitiveCapability>();
        for (const target of intents) {
            for (const capability of CAPABILITY_SELECTION[target]) selected.add(capability);
        }
        // Governance is a gate on consequential EXECUTION. This service is a
        // read-only advisory composition, so the gate is evaluated and recorded
        // rather than silently skipped.
        if (intents.includes("ACTION")) selected.add("GOVERNANCE");
        const executionOrder = EXECUTION_ORDER.filter((capability) => selected.has(capability));

        const executed: CapabilityExecution[] = [];
        const contradictions: CognitiveContradiction[] = [];
        // Canonical values asserted by the statement insight; every specialist
        // output is checked against these and may never overwrite them.
        const canonical = {
            netProfit: metric(insight, "netProfit"),
            revenue: metric(insight, "revenue"),
            totalAssets: metric(insight, "totalAssets"),
            totalLiabilities: metric(insight, "totalLiabilities"),
        };

        // ---- tenant-scoped cognitive memory --------------------------------
        // Memory is retrieved through the canonical MemoryEngine under the
        // caller's tenant. It may inform reasoning, but current canonical
        // evidence always outranks it: a disagreeing memory is reported as a
        // CANONICAL_WINS contradiction and preserved as historical context,
        // never averaged in and never written back onto the canonical value.
        const memory = this.retrieveCognitiveMemory({ tenantId, traceId, canonical, contradictions });

        // ---- tenant-scoped governed learning (B-05) --------------------------
        // Learning participates here as CONTEXT ONLY. Retrieval is delegated to
        // the canonical `GovernedLearningLifecycle`, which already enforces the
        // evidence gate, the governance gate, versioning, supersede/rollback and
        // tenant isolation. This module adds no second learning authority, does
        // not promote anything, and treats learned knowledge as strictly
        // subordinate to fresh canonical evidence.
        const learning = this.retrieveGovernedLearning({ tenantId, traceId, canonical, contradictions });

        for (const capability of executionOrder) {
            const record = this.executeCapability(capability, {
                insight, tenantId, input, contradictions, question, traceId,
            });
            if (record) executed.push(record);
        }

        // ---- reasoning over the collected orchestration context -----------
        const limitations = this.collectedLimitations;
        const reasoning = this.runReasoning({ question, intent, insight, input, executed, limitations, memoryRecords: this.retrievedMemory, learningArtifacts: this.retrievedLearning });

        const unavailable = executed.filter((entry) => entry.status === "UNAVAILABLE");
        return {
            tenantId,
            question,
            intent,
            selectedCapabilities: executionOrder,
            executionOrder,
            executed,
            executedCapabilities: executed.filter((entry) => entry.status === "EXECUTED").map((entry) => entry.capability),
            unavailableCapabilities: executed
                .filter((entry) => entry.status === "UNAVAILABLE")
                .map((entry) => ({
                    capability: entry.capability,
                    owner: entry.owner,
                    reason: entry.unavailableReason ?? "unavailable",
                })),
            contradictions,
            memory,
            learning,
            reasoning,
            limitations: Array.from(new Set(limitations)),
            traceId,
            status: executed.some((entry) => entry.status === "EXECUTED") ? "READY" : "PARTIAL",
        };
    }

    private executeCapability(
        capability: CognitiveCapability,
        ctx: {
            insight: FinancialStatementInsight | null;
            tenantId: string;
            input: CognitiveOrchestrationInput;
            contradictions: CognitiveContradiction[];
            question: string;
            traceId: string;
        },
    ): CapabilityExecution | null {
        const { insight, tenantId, input, contradictions, question, traceId } = ctx;
        const limitations = this.collectedLimitations;
        const insightRef = `FinancialStatementInsight:${tenantId}`;

        switch (capability) {
            case "COMPARATIVE_EVIDENCE": {
                if (!insight || insight.comparative.length === 0) {
                    return this.unavailable(capability, "RatioAnalysisService", "no comparative period evidence in the canonical insight", [], "دوره مقایسهای برای شواهد مقایسهای وجود ندارد");
                }
                return {
                    capability, owner: "RatioAnalysisService", status: "EXECUTED",
                    evidence: insight.comparative.map((entry) => `comparative:${entry.line}`),
                    result: {
                        entries: insight.comparative.map((entry) => ({
                            line: entry.line, current: entry.current, prior: entry.prior,
                            absoluteChange: entry.absoluteChange, pctChange: entry.pctChange,
                        })),
                    },
                };
            }

            case "INTEGRITY_EVIDENCE": {
                if (!insight || insight.integrity.length === 0) {
                    return this.unavailable(capability, "FinancialStatementInsight", "no integrity checks available", [], "کنترل یکپارچگی در دسترس نیست");
                }
                const notTestable = insight.integrity.filter((check) => check.status === "NOT_TESTABLE");
                const mismatches = insight.integrity.filter((check) => check.status === "MISMATCH");
                if (notTestable.length > 0) {
                    limitations.push(`کنترلهای غیرقابل آزمون: ${notTestable.map((check) => check.id).join("، ")}`);
                }
                return {
                    capability, owner: "FinancialStatementInsight", status: "EXECUTED",
                    evidence: insight.integrity.map((check) => `integrity:${check.id}:${check.status}`),
                    result: {
                        reconciled: insight.integrity.filter((check) => check.status === "RECONCILED").length,
                        mismatches: mismatches.map((check) => check.id),
                        notTestable: notTestable.map((check) => check.id),
                        unavailableRatios: [...insight.unavailableRatios],
                    },
                };
            }

            case "PRODUCT_SEGMENT": {
                if (!insight?.productSegments) {
                    return this.unavailable(
                        capability, "ProductSegmentAnalysis",
                        "the canonical document carries no per-product revenue/cost table",
                        [], "داده سودآوری محصول/بخش در سند وجود ندارد و از جمع‌های کل استنتاج نمی‌شود",
                    );
                }
                return {
                    capability, owner: "ProductSegmentAnalysis", status: "EXECUTED",
                    evidence: insight.productSegments.contributions.map((segment) => `segment:${segment.name}`),
                    result: {
                        segmentCount: insight.productSegments.segmentCount,
                        overallGrossMargin: insight.productSegments.overallGrossMargin,
                        topRevenue: insight.productSegments.topRevenueContribution?.name ?? null,
                        limitations: insight.productSegments.limitations,
                    },
                };
            }

            case "SCENARIO": {
                if (!insight) {
                    return this.unavailable(capability, "FinancialDecisionNarrativeService.composeScenarios", "no canonical insight to ground scenarios in", [], "سند کاننیکال برای ساخت سناریو در دسترس نیست");
                }
                const scenarios = composeScenarios(insight);
                return {
                    capability, owner: "FinancialDecisionNarrativeService.composeScenarios", status: "EXECUTED",
                    evidence: [`scenarios:${scenarios.map((scenario) => scenario.label).join("|")}`],
                    result: { scenarioCount: scenarios.length, labels: scenarios.map((scenario) => scenario.label) },
                };
            }

            case "ACTION_FINDINGS": {
                if (!insight || insight.managementActions.length === 0) {
                    return this.unavailable(capability, "FinancialStatementInsight", "no management action findings in the canonical insight", [], "اقدام مستندی از شواهد سند استخراج نشد");
                }
                return {
                    capability, owner: "FinancialStatementInsight", status: "EXECUTED",
                    evidence: insight.managementActions.flatMap((finding) => finding.evidence.map((item) => `action:${item.split("=")[0]}`)),
                    result: {
                        count: insight.managementActions.length,
                        findings: insight.managementActions.map((finding) => ({
                            message: finding.message, evidenceLevel: finding.evidenceLevel, evidence: finding.evidence,
                        })),
                    },
                };
            }

            case "FINANCIAL_INTELLIGENCE": {
                const revenue = metric(insight, "revenue");
                const netProfit = metric(insight, "netProfit");
                const assets = metric(insight, "totalAssets");
                const liabilities = metric(insight, "totalLiabilities");
                if (revenue === null || netProfit === null || assets === null || liabilities === null) {
                    return this.unavailable(
                        capability, "FinancialIntelligenceEngine",
                        "canonical revenue, net profit, assets and liabilities are all required",
                        [insightRef], "ارقام پایه کاننیکال برای اجرای قابلیت مالی کامل نیست",
                    );
                }
                // B-03.1 — the total-expense basis is CONSUMED from the canonical
                // insight (`derivedResidual`), never reconstructed here. This
                // module performs no financial arithmetic: if the canonical
                // residual is absent it is absent, and the capability is honestly
                // reported UNAVAILABLE rather than filled with a local
                // `revenue - netProfit` computation. `FinancialIntelligenceEngine`
                // remains the only owner of financial mathematics.
                const canonicalResidual = insight?.derivedResidual ?? null;
                const expenses =
                    canonicalResidual && Number.isFinite(canonicalResidual.value)
                        ? canonicalResidual.value
                        : null;
                if (expenses === null) {
                    return this.unavailable(
                        capability, "FinancialIntelligenceEngine",
                        "the canonical insight carries no derived residual expense basis; it is consumed, never reconstructed as revenue minus net profit",
                        [insightRef], "مبنای هزینه باقیمانده کاننیکال در سند موجود نیست و در این لایه محاسبه نمی‌شود",
                    );
                }
                const analysis = this.financial.analyze({ revenue, expenses, assets, liabilities });
                if (analysis.status !== "READY") {
                    return this.unavailable(capability, "FinancialIntelligenceEngine", "the canonical financial analysis returned BLOCKED", [insightRef], "تحلیل مالی کاننیکال آماده نشد");
                }
                // Consistency gate: the specialist result must agree with the
                // canonical statement values. A disagreement is surfaced, never
                // averaged away and never written back onto the canonical value.
                if (!agrees(analysis.profit, netProfit)) {
                    contradictions.push({
                        subject: "netProfit", canonicalValue: netProfit, specialistValue: analysis.profit,
                        difference: analysis.profit - netProfit, resolution: "CANONICAL_WINS",
                        note: "canonical statement net profit is authoritative",
                    });
                }
                const canonicalDebtRatio = insight!.ratios.debtToAssets;
                if (canonicalDebtRatio !== null && !agrees(analysis.debtRatio, canonicalDebtRatio)) {
                    contradictions.push({
                        subject: "debtRatio", canonicalValue: canonicalDebtRatio, specialistValue: analysis.debtRatio,
                        difference: analysis.debtRatio - canonicalDebtRatio, resolution: "CANONICAL_WINS",
                        note: "canonical ratio owner is authoritative",
                    });
                }
                const canonicalNetMargin = insight!.ratios.netMargin;
                if (canonicalNetMargin !== null && !agrees(analysis.profitMargin, canonicalNetMargin)) {
                    contradictions.push({
                        subject: "profitMargin", canonicalValue: canonicalNetMargin, specialistValue: analysis.profitMargin,
                        difference: analysis.profitMargin - canonicalNetMargin, resolution: "CANONICAL_WINS",
                        note: "canonical ratio owner is authoritative",
                    });
                }
                return {
                    capability, owner: "FinancialIntelligenceEngine", status: "EXECUTED",
                    evidence: [
                        `revenue=${revenue}`, `netProfit=${netProfit}`,
                        `assets=${assets}`, `liabilities=${liabilities}`,
                        `expensesBasis=derivedResidual`, `expenses=${expenses}`,
                    ],
                    result: {
                        revenue: analysis.revenue, expenses: analysis.expenses, profit: analysis.profit,
                        profitMargin: analysis.profitMargin, debtRatio: analysis.debtRatio, status: analysis.status,
                    },
                };
            }

            case "LIQUIDITY_LEVERAGE": {
                if (!insight) {
                    return this.unavailable(capability, "FinancialIntelligenceEngine", "no canonical insight", [], "سند کاننیکال در دسترس نیست");
                }
                const currentAssets = metric(insight, "currentAssets");
                const currentLiabilities = metric(insight, "currentLiabilities");
                const inventory = metric(insight, "inventory");
                const cash = metric(insight, "cash");
                if (currentAssets === null || currentLiabilities === null || inventory === null || cash === null) {
                    return this.unavailable(
                        capability, "FinancialIntelligenceEngine.liquidityRatios",
                        "canonical current assets, inventory, cash and current liabilities are all required",
                        [insightRef], "ورودیهای نسبت نقدینگی کامل در سند موجود نیست",
                    );
                }
                const ratios = this.financial.liquidityRatios({
                    currentAssets, inventory, cash, currentLiabilities,
                });
                if (ratios.status !== "READY") {
                    return this.unavailable(capability, "FinancialIntelligenceEngine.liquidityRatios", "canonical liquidity computation returned BLOCKED", [insightRef], "نسبتهای نقدینگی آماده نشد");
                }
                const canonicalCurrentRatio = insight.ratios.currentRatio;
                if (canonicalCurrentRatio !== null && !agrees(ratios.currentRatio, canonicalCurrentRatio)) {
                    contradictions.push({
                        subject: "currentRatio", canonicalValue: canonicalCurrentRatio, specialistValue: ratios.currentRatio,
                        difference: ratios.currentRatio - canonicalCurrentRatio, resolution: "CANONICAL_WINS",
                        note: "canonical ratio owner is authoritative",
                    });
                }
                return {
                    capability, owner: "FinancialIntelligenceEngine.liquidityRatios", status: "EXECUTED",
                    evidence: [`currentAssets=${currentAssets}`, `currentLiabilities=${currentLiabilities}`, `inventory=${inventory}`, `cash=${cash}`],
                    result: {
                        currentRatio: ratios.currentRatio, quickRatio: ratios.quickRatio, cashRatio: ratios.cashRatio,
                        debtToAssets: insight.ratios.debtToAssets, debtToEquity: insight.ratios.debtToEquity,
                    },
                };
            }

            case "WORKING_CAPITAL": {
                const revenue = metric(insight, "revenue");
                const cogs = metric(insight, "cogs");
                const receivables = metric(insight, "receivables");
                const inventory = metric(insight, "inventory");
                const payables = metric(insight, "payables");
                if (revenue === null || cogs === null || receivables === null || inventory === null || payables === null) {
                    return this.unavailable(
                        capability, "FinancialIntelligenceEngine.workingCapital",
                        "canonical revenue, cogs, receivables, inventory and payables are all required",
                        [], "ورودیهای چرخه سرمایه در گردش کامل نیست",
                    );
                }
                const wc = this.financial.workingCapital({ revenue, cogs, receivables, inventory, payables });
                if (wc.status !== "READY") {
                    return this.unavailable(capability, "FinancialIntelligenceEngine.workingCapital", "canonical working-capital computation returned BLOCKED", [], "چرخه سرمایه در گردش آماده نشد");
                }
                return {
                    capability, owner: "FinancialIntelligenceEngine.workingCapital", status: "EXECUTED",
                    evidence: [`revenue=${revenue}`, `cogs=${cogs}`, `receivables=${receivables}`, `inventory=${inventory}`, `payables=${payables}`],
                    result: {
                        netWorkingCapital: wc.netWorkingCapital, receivablesDays: wc.receivablesDays,
                        inventoryDays: wc.inventoryDays, payablesDays: wc.payablesDays,
                        cashConversionCycle: wc.cashConversionCycle,
                    },
                };
            }

            case "EARNINGS_QUALITY": {
                const quality = insight?.cashFlow?.qualityOfEarnings ?? "UNAVAILABLE";
                const operating = insight?.cashFlow?.operating ?? null;
                if (quality === "UNAVAILABLE" && operating === null) {
                    return this.unavailable(capability, "FinancialStatementInsight", "no cash-flow evidence to assess earnings quality", [], "شواهد جریان نقد برای سنجش کیفیت سود موجود نیست");
                }
                return {
                    capability, owner: "FinancialStatementInsight", status: "EXECUTED",
                    evidence: [`operatingCashFlow=${operating ?? "unavailable"}`, `qualityOfEarnings=${quality}`],
                    result: { operatingCashFlow: operating, qualityOfEarnings: quality },
                };
            }

            case "RISK_INTELLIGENCE": {
                // RiskIntelligenceEngine.assess requires a risk probability and
                // impact. A statement document does not carry them, and the
                // orchestration never invents them to make the capability run.
                return this.unavailable(
                    "RISK_INTELLIGENCE", "RiskIntelligenceEngine.assess",
                    "a statement document carries no canonical risk probability/impact; none was invented",
                    [], "ورودی احتمال و اثر ریسک در سند کاننیکال وجود ندارد و ساخته نمی‌شود",
                );
            }

            case "ORGANIZATIONAL_INTELLIGENCE": {
                if (!insight) {
                    return this.unavailable(capability, "OrganizationalIntelligenceEngine.diagnose", "no canonical insight to diagnose against", [], "سند کاننیکال در دسترس نیست");
                }
                const evidence = this.organizationalEvidence(insight);
                if (Object.keys(evidence).length === 0) {
                    return this.unavailable(
                        capability, "OrganizationalIntelligenceEngine.diagnose",
                        "the canonical record carries no genuine organizational evidence; financial ratios, cash flow and accounting integrity are financial evidence, not organizational evidence, and are never re-labelled as such",
                        [], "شواهد سازمانی (ساختار، فرایند، ظرفیت یا جریان تصمیم) در سند کاننیکال وجود ندارد؛ نسبت‌های مالی شواهد سازمانی محسوب نمی‌شوند",
                    );
                }
                const diagnosis = this.organizational.diagnose("financial-resilience", evidence);
                return {
                    capability, owner: "OrganizationalIntelligenceEngine.diagnose", status: "EXECUTED",
                    evidence: Object.keys(evidence).map((key) => `organizational:${key}`),
                    result: {
                        status: diagnosis.status, rootCauses: diagnosis.rootCauses,
                        affectedProcesses: diagnosis.affectedProcesses, recommendations: diagnosis.recommendations,
                    },
                };
            }

            case "EXECUTIVE_INTELLIGENCE": {
                const workbench = input.executiveWorkbench ?? null;
                if (!workbench || workbench.recommendations.length === 0) {
                    return this.unavailable(
                        "EXECUTIVE_INTELLIGENCE", "ExecutiveIntelligenceEngine",
                        "no executive target/KPI evidence exists in the canonical record; executive synthesis would require invented targets",
                        [], "هدف یا شاخص اجرایی کاننیکال برای قضاوت اجرایی وجود ندارد و ساخته نمی‌شود",
                    );
                }
                return {
                    capability, owner: "ExecutiveIntelligenceWorkbench", status: "EXECUTED",
                    evidence: workbench.recommendations.map((item) => `executive:${item.action}`),
                    result: { recommendationCount: workbench.recommendations.length },
                };
            }

            case "DECISION_INTELLIGENCE": {
                // DecisionIntelligenceEngine owns AHP/TOPSIS mathematics and
                // requires a pairwise matrix and a criteria matrix. A financial
                // statement question supplies neither.
                return this.unavailable(
                    "DECISION_INTELLIGENCE", "DecisionIntelligenceEngine",
                    "no decision request with pairwise/criteria matrices is present in this question",
                    [], "در این پرسش ماتریس تصمیم ارائه نشده است",
                );
            }

            case "GOVERNANCE": {
                if (!input.securityContext) {
                    return {
                        capability, owner: "GovernanceEngine", status: "UNAVAILABLE",
                        unavailableReason: "no security context was supplied to the governance gate",
                        evidence: [], result: {},
                    };
                }
                // The question asks what SHOULD be done; this composition never
                // performs the action, so the gate is evaluated for an approval
                // check rather than an execution.
                const governance: GovernanceResult = this.governance.evaluate({
                    action: "APPROVE_DECISION",
                    securityContext: input.securityContext,
                    parameters: { question },
                    traceId,
                });
                if (governance.status === "DENIED") {
                    limitations.push("ارزیابی حاکمیتی: اقدام پیشنهادی بدون مجوز اجرایی مجاز نیست.");
                }
                return {
                    capability, owner: "GovernanceEngine.evaluate", status: "EXECUTED",
                    evidence: [`governance:${governance.status}`, `governance:policies=${governance.appliedPolicies.length}`],
                    result: {
                        status: governance.status, requiresHumanApproval: governance.requiresHumanApproval,
                        appliedPolicies: governance.appliedPolicies,
                    },
                };
            }

            case "ORGANIZATIONAL_PROBLEM_SOLVING": {
                const cases = input.problemCases ?? [];
                if (!cases || cases.length === 0) {
                    return this.unavailable(
                        capability, "OrganizationalProblemSolvingService",
                        "no organizational problem cases exist for this tenant; cannot execute without genuine evidence",
                        [], "پرونده مسئله سازمانی برای این مستأجر وجود ندارد؛ بدون شاهد اصلی قابل اجرا نیست",
                    );
                }
                // Use the most recent active case
                const activeCase = cases.find((c) => c.stage !== "RESOLVED" && c.stage !== "LEARNED") ?? cases[0];
                return {
                    capability, owner: "OrganizationalProblemSolvingService", status: "EXECUTED",
                    evidence: [`problem-case:${activeCase.problemId}`, `stage:${activeCase.stage}`, `category:${activeCase.category}`],
                    result: {
                        problemId: activeCase.problemId,
                        title: activeCase.title,
                        category: activeCase.category,
                        stage: activeCase.stage,
                    },
                };
            }

            case "DECISION_WORKBENCH": {
                const decision = input.decisionWorkbench;
                if (!decision) {
                    return this.unavailable(
                        capability, "DecisionWorkbench",
                        "no decision workbench result exists for this tenant; cannot execute without genuine evidence",
                        [], "پرونده کارگاه تصمیم برای این مستأجر وجود ندارد؛ بدون ماتریس تصمیم قابل اجرا نیست",
                    );
                }
                return {
                    capability, owner: "DecisionWorkbench", status: "EXECUTED",
                    evidence: [`decision:${decision.problem}`, `method:${decision.method}`, `alternatives:${decision.evaluations.length}`],
                    result: {
                        problem: decision.problem,
                        method: decision.method,
                        alternatives: decision.evaluations.map((e) => e.alternative),
                    },
                };
            }

            case "AUTONOMOUS_OPERATIONS": {
                // Autonomous operations require workflow evidence which is not passed through orchestration input
                // This capability is available when the runtime has workflow context
                return this.unavailable(
                    capability, "AutonomousOperationsEngine",
                    "no workflow context available in cognitive orchestration; workflow execution requires direct runtime access",
                    [], "بافت وَرک‌فلو در ارکستراسیون شناختی موجود نیست؛ اجرای عملیات نیازمند دسترسی مستقیم به ран‌تایم است",
                );
            }

            case "EXECUTIVE_WORKBENCH": {
                const workbench = input.executiveWorkbench ?? null;
                if (!workbench || workbench.recommendations.length === 0) {
                    return this.unavailable(
                        capability, "ExecutiveIntelligenceWorkbench",
                        "no executive targets/KPIs configured for this tenant; executive workbench requires targets",
                        [], "هدف یا شاخص اجرایی برای این مستأجر تنظیم نشده؛ کارگاه هوش اجرایی نیازمند اهداف است",
                    );
                }
                return {
                    capability, owner: "ExecutiveIntelligenceWorkbench", status: "EXECUTED",
                    evidence: workbench.recommendations.map((item) => `executive:${item.action}`),
                    result: {
                        recommendationCount: workbench.recommendations.length,
                        note: "requires financial analysis result and targets for full execution",
                    },
                };
            }

            case "REASONING":
                // Executed by orchestrate() after all evidence capabilities.
                return null;

            default:
                return null;
        }
    }

    /**
     * Limitations collected during the current synchronous `orchestrate()`
     * call. Scoped per call so capability execution stays side-effect free
     * between orchestrations (the service holds no cross-request state).
     */
    private collectedLimitations: string[] = [];

    /**
     * Tenant-scoped memory records retrieved for the current synchronous
     * `orchestrate()` call. Scoped per call so the service holds no cross-request
     * state of its own; the MemoryEngine remains the memory owner.
     */
    private retrievedMemory: MemoryEvent[] = [];

    /**
     * Governed learning artifacts retrieved for the current synchronous
     * `orchestrate()` call. Scoped per call so the service holds no
     * cross-request state of its own; `GovernedLearningLifecycle` remains the
     * single learning owner.
     */
    private retrievedLearning: LearningArtifact[] = [];

    /**
     * Retrieve the caller tenant's eligible governed learning artifacts through
     * the canonical `GovernedLearningLifecycle` and detect disagreement with the
     * current canonical evidence.
     *
     * Fail-closed by construction: without an explicit tenant scope retrieval
     * does not occur at all, and without an injected lifecycle nothing is
     * retrieved. Only `ACTIVE` + `PROMOTED` artifacts the lifecycle considers
     * eligible reach reasoning, so a superseded version is never active context.
     *
     * Canonical fact safety: a disagreeing learned assertion is reported as a
     * `CANONICAL_WINS` contradiction on both the learning provenance and the
     * standard contradiction channel. The canonical value is never overwritten,
     * averaged, merged or discarded, the artifact is never deleted, and the
     * canonical insight object is never mutated.
     */
    private retrieveGovernedLearning(ctx: {
        tenantId: string;
        traceId: string;
        canonical: { netProfit: number | null; revenue: number | null; totalAssets: number | null; totalLiabilities: number | null };
        contradictions: CognitiveContradiction[];
    }): GovernedLearningProvenance {
        const scope = typeof ctx.tenantId === "string" ? ctx.tenantId.trim() : "";
        const base: GovernedLearningProvenance = {
            retrievalOccurred: false,
            tenantId: scope || null,
            retrievedCount: 0,
            artifactRefs: [],
            activeVersions: [],
            traceId: ctx.traceId,
            authoritativeSource: "CURRENT_CANONICAL_EVIDENCE",
            contradictions: [],
        };
        if (!scope || !this.learning) return base;

        let artifacts: readonly LearningArtifact[];
        try {
            artifacts = this.learning.retrieveActiveSync(scope);
        } catch {
            // A retrieval failure is never fatal to the answer, and it never
            // degrades into returning another tenant's learning.
            return base;
        }
        this.retrievedLearning = [...artifacts];

        const contradictions: CognitiveLearningConflict[] = [];
        for (const artifact of artifacts) {
            for (const assertion of learningAssertions(artifact)) {
                const canonicalValue = canonicalMemorySubject(ctx.canonical, assertion.subject);
                if (canonicalValue === null) continue;
                if (agrees(assertion.value, canonicalValue)) continue;
                contradictions.push({
                    subject: assertion.subject,
                    learnedValue: assertion.value,
                    canonicalValue,
                    difference: assertion.value - canonicalValue,
                    resolution: "CANONICAL_WINS",
                    artifactRef: artifact.artifactId,
                    artifactVersion: artifact.version,
                    note: "fresh canonical evidence is authoritative; the governed learning artifact is preserved as context and is never merged into the canonical value",
                });
                ctx.contradictions.push({
                    subject: assertion.subject,
                    canonicalValue,
                    specialistValue: assertion.value,
                    difference: assertion.value - canonicalValue,
                    resolution: "CANONICAL_WINS",
                    note: `governed learning artifact ${artifact.artifactId} v${artifact.version} disagrees with current canonical evidence; canonical evidence wins and the learning artifact is preserved as context`,
                });
            }
        }

        return {
            ...base,
            retrievalOccurred: true,
            retrievedCount: artifacts.length,
            artifactRefs: artifacts.map((artifact) => artifact.artifactId),
            activeVersions: artifacts.map((artifact) => artifact.version),
            contradictions,
        };
    }

    /**
     * Retrieve the caller tenant's cognitive memory through the canonical
     * MemoryEngine and detect disagreements with the current canonical evidence.
     *
     * Retrieval is fail-closed: without an explicit tenant scope it does not
     * occur at all, and the canonical engine can only ever return that tenant's
     * records. A disagreeing memory is surfaced as a CANONICAL_WINS
     * contradiction; the canonical value is never overwritten.
     */
    private retrieveCognitiveMemory(ctx: {
        tenantId: string;
        traceId: string;
        canonical: { netProfit: number | null; revenue: number | null; totalAssets: number | null; totalLiabilities: number | null };
        contradictions: CognitiveContradiction[];
    }): CognitiveMemoryProvenance {
        const scope = typeof ctx.tenantId === "string" ? ctx.tenantId.trim() : "";
        const base: CognitiveMemoryProvenance = {
            retrievalOccurred: false,
            tenantId: scope || null,
            retrievedCount: 0,
            references: [],
            traceId: ctx.traceId,
            authoritativeSource: "CURRENT_CANONICAL_EVIDENCE",
            conflicts: [],
        };
        if (!scope) return base;

        const records = this.memory.retrieve(scope);
        this.retrievedMemory = [...records];

        const conflicts: CognitiveMemoryConflict[] = [];
        for (const record of records) {
            for (const assertion of memoryAssertions(record)) {
                const canonicalValue = canonicalMemorySubject(ctx.canonical, assertion.subject);
                if (canonicalValue === null) continue;
                if (agrees(assertion.value, canonicalValue)) continue;
                conflicts.push({
                    subject: assertion.subject,
                    memoryValue: assertion.value,
                    canonicalValue,
                    difference: assertion.value - canonicalValue,
                    resolution: "CANONICAL_WINS",
                    memoryRef: record.id,
                    note: "current canonical evidence is authoritative; the disagreeing memory is preserved as historical context",
                });
                ctx.contradictions.push({
                    subject: assertion.subject,
                    canonicalValue,
                    specialistValue: assertion.value,
                    difference: assertion.value - canonicalValue,
                    resolution: "CANONICAL_WINS",
                    note: "historical memory disagrees with current canonical evidence; canonical evidence wins and memory is preserved as context",
                });
            }
        }

        return {
            ...base,
            retrievalOccurred: true,
            retrievedCount: records.length,
            references: records.map((record) => record.id),
            conflicts,
        };
    }

    private unavailable(
        capability: CognitiveCapability,
        owner: string,
        unavailableReason: string,
        evidence: readonly string[],
        limitation: string,
    ): CapabilityExecution {
        this.collectedLimitations.push(limitation);
        return { capability, owner, status: "UNAVAILABLE", unavailableReason, evidence, result: {} };
    }

    /**
     * Genuine organizational evidence: facts about HOW the company operates —
     * organizational structure, process behaviour, capacity, staffing,
     * decision/approval flow or recorded organizational events.
     *
     * A financial statement is NOT organizational evidence. `currentRatio`,
     * `debtToAssets`, `operatingCashFlow` and accounting-integrity outcomes are
     * FINANCIAL evidence: they describe the numbers, never the organization.
     * Re-labelling them as organizational evidence would make
     * `OrganizationalIntelligenceEngine` reason causally about a process from a
     * balance-sheet ratio, so they are never admitted here. No financial metric
     * is ever converted into organizational evidence.
     *
     * The canonical record consumed by this composition is a financial statement
     * insight, which carries no organizational signal, so this extractor admits
     * nothing and the capability is reported `UNAVAILABLE` rather than faked.
     */
    private organizationalEvidence(_insight: FinancialStatementInsight): Record<string, unknown> {
        return {};
    }

     /**
      * Reasoning runs LAST, over the context actually produced by the executed
      * capabilities. It interprets; it never rewrites a canonical value.
      */
     private runReasoning(ctx: {
         question: string;
         intent: QuestionIntent;
         insight: FinancialStatementInsight | null;
         input: CognitiveOrchestrationInput;
         executed: readonly CapabilityExecution[];
         limitations: string[];
         memoryRecords: readonly MemoryEvent[];
         learningArtifacts?: readonly LearningArtifact[];
     }): CognitiveOrchestrationResult["reasoning"] {
         const { question, intent, insight, input, executed, limitations, memoryRecords } = ctx;
         const learningArtifacts = ctx.learningArtifacts ?? [];
         const evidenceLines: string[] = [];
         for (const entry of executed) {
             if (entry.status === "EXECUTED") {
                 evidenceLines.push(`${entry.capability} via ${entry.owner}: ${Object.keys(entry.result).join(",")}`);
             } else if (entry.status === "UNAVAILABLE") {
                 evidenceLines.push(`${entry.capability} UNAVAILABLE (${entry.unavailableReason})`);
             }
          }
          if (evidenceLines.length === 0) {
              limitations.push("هیچ قابلیت کاننیکالی برای این پرسش اجرا نشد.");
              return { status: "UNAVAILABLE", conclusion: null, confidenceSource: "unavailable", steps: [] };
          }
        // The reasoning input carries the CANONICAL derived values produced by
        // the executed canonical owners, so `IntelligenceEngine` reasons over
        // real verified evidence (it consumes these values; per B-01 it never
        // re-derives them). Capability results are attached as structured
        // context alongside them.
        const insightData: IntelligenceInput["data"] = {};
        for (const entry of executed) {
            if (entry.status === "EXECUTED") insightData[entry.capability] = entry.result;
        }
        const financial = executed.find((entry) => entry.capability === "FINANCIAL_INTELLIGENCE" && entry.status === "EXECUTED");
        if (financial) {
            const canonical = canonicalFinancialValues(insight);
            insightData.revenue = financial.result.revenue as number;
            insightData.profit = financial.result.profit as number;
            insightData.profitMargin = financial.result.profitMargin as number;
            if (typeof financial.result.debtRatio === "number") insightData.debtRatio = financial.result.debtRatio as number;
            else if (canonical.debtRatio !== null) insightData.debtRatio = canonical.debtRatio;
        }
        const liquidity = executed.find((entry) => entry.capability === "LIQUIDITY_LEVERAGE" && entry.status === "EXECUTED");
        if (liquidity && typeof liquidity.result.currentRatio === "number" && typeof insightData.profitMargin !== "number") {
            // Liquidity-only evidence still gives the reasoning layer a
            // canonical, evidence-backed basis.
            insightData.liquidityRatio = liquidity.result.currentRatio as number;
        }
         const intelligenceInput: IntelligenceInput = {
             problem: question || intent.userGoal,
             data: insightData,
         };
          const intelligenceContext: IntelligenceContext = {
              // Historical memory informs reasoning as low-confidence context. It
              // is never admitted as canonical evidence: the canonical values below
              // remain the authoritative `data` the reasoning layer consumes.
              knowledgeItems: [
                  ...memoryRecords.slice(0, 5).map((record) => ({
                      id: record.id,
                      title: record.type,
                      description: `historical memory (${record.source}): ${record.data}`,
                      confidence: 0.5,
                      source: `memory:${record.source}`,
                      createdAt: record.createdAt.toISOString(),
                      ...(record.tenantId ? { tenantId: record.tenantId } : {}),
                  })),
                  // B-05: governed learning is contextual evidence only. It reached
                  // this point through the full governed lifecycle — real observation,
                  // validated evidence, a separately measured result and a governance
                  // ALLOWED promotion — and only as an ACTIVE version. It is supplied
                  // as low-confidence knowledge and is never admitted as canonical
                  // financial truth: the canonical `data` above remains authoritative.
                  ...learningArtifacts.slice(0, 5).map((artifact) => ({
                      id: artifact.artifactId,
                      title: `learning:${artifact.subject}@v${artifact.version}`,
                      description: `${artifact.statement} (measured ${artifact.measuredResult.metric}=${artifact.measuredResult.value} → ${artifact.measuredResult.outcome}; evidence ${artifact.evidenceRef}; source ${artifact.sourceRef})`,
                      confidence: 0.5,
                      source: `learning:${artifact.evidenceRef}`,
                      createdAt: artifact.provenance.createdAt,
                      tenantId: artifact.tenantId,
                  })),
              ],
              evidenceItems: [
                 ...(input.evidenceRefs ?? []).map((ref) => ({
                     id: ref, type: "SOURCE_REF", summary: ref, sourceRef: ref, tenantId: input.tenantId,
                 })),
                 ...executed.filter((entry) => entry.status === "EXECUTED").flatMap((entry) => entry.evidence.map((ref) => ({
                     id: ref, type: entry.capability, summary: `${entry.capability} via ${entry.owner}`, sourceRef: ref, tenantId: input.tenantId,
                 }))),
             ],
          };
          const result = this.intelligence.reason(intelligenceInput, intelligenceContext);
          return {
              status: "EXECUTED",
              conclusion: result.conclusion,
              confidenceSource: result.confidence.source,
              steps: result.reasoningSteps,
          };
    }
}
