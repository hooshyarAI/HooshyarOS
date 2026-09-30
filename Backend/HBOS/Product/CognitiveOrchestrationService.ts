/**
 * product.cognitive-orchestration — B-03 live cognitive orchestration.
 *
 * This module is a COMPOSITION over the existing canonical Engines. It is NOT
 * an Engine, NOT a new cognitive core, and NOT an owner of any domain logic:
 *
 *   - `FinancialIntelligenceEngine` remains the owner of canonical financial
 *     mathematics. This module only *calls* it and *verifies* its output against
 *     the canonical statement insight. It never re-computes a ratio.
 *   - `RiskIntelligenceEngine` and `ExecutiveIntelligenceEngine` remain the
 *     owners of risk scoring and executive synthesis. When the canonical record
 *     carries no input they could honestly accept, this module reports them
 *     `UNAVAILABLE` — it does not hold an instance in order to look wired, and
 *     it never fabricates the missing input to force execution.
 *   - `OrganizationalIntelligenceEngine` remains the owner of organizational
 *     intelligence.
 *   - `GovernanceEngine` remains the owner of policy / authorization.
 *   - `IntelligenceEngine` remains the sanctioned reasoning-pipeline composer.
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
import type { SecurityContext } from "../Security/SecurityContext";
import { composeScenarios, analyzeQuestion, type QuestionIntent } from "./FinancialDecisionNarrativeService";
import type { FinancialStatementInsight } from "./FinancialStatementInsight";

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
  | "REASONING";

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

export interface CognitiveOrchestrationInput {
  readonly tenantId: string;
  readonly question: string;
  readonly insight: FinancialStatementInsight | null;
  /** Existing executive workbench result, when the runtime already has one. */
  readonly executiveWorkbench?: { readonly recommendations: readonly { readonly action: string }[] } | null;
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
  "EXECUTIVE_INTELLIGENCE",
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

    constructor(
        financial?: FinancialIntelligenceEngine,
        organizational?: OrganizationalIntelligenceEngine,
        governance?: GovernanceEngine,
        intelligence?: IntelligenceEngine,
    ) {
        this.financial = financial ?? new FinancialIntelligenceEngine();
        this.organizational = organizational ?? new OrganizationalIntelligenceEngine();
        this.governance = governance ?? new GovernanceEngine();
        this.intelligence = intelligence ?? new IntelligenceEngine();
    }

    orchestrate(input: CognitiveOrchestrationInput): CognitiveOrchestrationResult {
        this.collectedLimitations = [];
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

        for (const capability of executionOrder) {
            const record = this.executeCapability(capability, {
                insight, tenantId, input, contradictions, question, traceId,
            });
            if (record) executed.push(record);
        }

        // ---- reasoning over the collected orchestration context -----------
        const limitations = this.collectedLimitations;
        const reasoning = this.runReasoning({ question, intent, insight, input, executed, limitations });

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
                // The platform's canonical total-expense basis is the residual
                // (revenue − verified net profit). It is passed to the canonical
                // owner, which performs the mathematics; this module never
                // derives profit itself.
                const expenses = revenue - netProfit;
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
                    return this.unavailable(capability, "OrganizationalIntelligenceEngine.diagnose", "no organizational evidence in the canonical insight", [], "شواهد سازمانی در سند موجود نیست");
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

    private organizationalEvidence(insight: FinancialStatementInsight): Record<string, unknown> {
        const evidence: Record<string, unknown> = {};
        const currentRatio = insight.ratios.currentRatio;
        const debtToAssets = insight.ratios.debtToAssets;
        if (currentRatio !== null) evidence.liquidityRatio = currentRatio;
        if (debtToAssets !== null) evidence.leverage = debtToAssets;
        if (insight.cashFlow.operating !== null) evidence.cashGeneration = insight.cashFlow.operating;
        const integrityMismatch = insight.integrity.some((check) => check.status === "MISMATCH");
        if (integrityMismatch) evidence.quality = "integrity-mismatch";
        const notTestable = insight.integrity.filter((check) => check.status === "NOT_TESTABLE").length;
        if (notTestable > 0) evidence.quality = `not-testable-checks=${notTestable}`;
        return evidence;
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
    }): CognitiveOrchestrationResult["reasoning"] {
        const { question, intent, insight, input, executed, limitations } = ctx;
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
            knowledgeItems: [],
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
