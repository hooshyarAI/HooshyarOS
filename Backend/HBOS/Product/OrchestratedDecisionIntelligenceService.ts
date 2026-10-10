import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";
import { RiskIntelligenceEngine } from "../Engines/RiskIntelligenceEngine";
import {
    AhpResult,
    DecisionIntelligenceEngine,
    DecisionMethodId,
    DecisionTreeNode,
    DecisionTreeResult,
    TopsisResult
} from "../Engines/DecisionIntelligenceEngine";
import { KnowledgeEngine, ScienceSelectionPlan, ScienceSignal } from "../Engines/KnowledgeEngine";
import { ProvenanceTrace } from "../Core/ProvenanceTrace";

/**
 * Phase 09-1.15: Orchestrated Decision Intelligence (product service).
 *
 * This composition owner is the brain-facing workflow boundary: it routes
 * explicit signals to the existing science register, invokes existing math
 * owners, and reports an evidence-aware quality gate. It does not create an
 * alternative engine hierarchy or let narrative reasoning replace calculation.
 *
 * The result is the signal returned to downstream nervous-system/workflow
 * consumers. Trace identifiers and hashes let those consumers correlate the
 * selected sciences, execution result and quality verdict.
 *
 * Tenant isolation: tenantId is propagated through the output; this service
 * does not store tenant data or replace the canonical persistence boundary.
 */

export interface OrchestratedInput {
    tenantId: string;
    problem: string;
    financial: {
        revenue: number;
        expenses: number;
        assets: number;
        liabilities: number;
        cashFlows: { initial: number; flows: readonly number[]; discountRate: number };
        waccInputs: { equity: number; debt: number; costOfEquity: number; costOfDebt: number; taxRate: number };
    };
    risk: {
        probability: number;
        impact: number;
        /** Optional AHP weights for sensitivity ranking. */
        criteria?: { name: string; params: Readonly<Record<string, number>> }[];
        model: (p: Readonly<Record<string, number>>) => number;
    };
    decision: {
        ahpMatrix: readonly (readonly number[])[];
        topsis: { matrix: readonly (readonly number[])[]; weights: readonly number[]; criteria: ReadonlyArray<"benefit" | "cost"> };
        /** Optional expected-value tree; it runs only when a tree is supplied. */
        decisionTree?: DecisionTreeNode;
    };
    /**
     * Extra structured science signals. Baseline financial, risk and
     * multi-criteria signals are derived from this typed workflow's input
     * sections; free text in "problem" is never used to guess a science.
     */
    additionalScienceSignals?: readonly ScienceSignal[];
}

export type DecisionQualityCheckStatus = "PASS" | "REVIEW_REQUIRED" | "BLOCKED";

export interface DecisionQualityCheck {
    readonly id: string;
    readonly status: DecisionQualityCheckStatus;
    readonly detail: string;
}

export interface DecisionQualityReport {
    readonly status: DecisionQualityCheckStatus;
    readonly requiresHumanReview: boolean;
    readonly checks: readonly DecisionQualityCheck[];
    readonly provenance: {
        readonly traceId: string;
        readonly sourceRef: string;
        readonly timestamp: string;
        readonly inputHash: string;
        readonly outputHash: string;
        readonly verificationStatus: "VERIFIED" | "PENDING" | "FAILED";
        readonly reasoningSteps: readonly string[];
    };
}

export type OrchestratedStatus = "READY" | "PARTIAL" | "BLOCKED";

export interface OrchestratedResult {
    /** Execution-only status, separate from quality qualification. */
    executionStatus: OrchestratedStatus;
    /** Quality-gated status suitable for downstream decision workflows. */
    status: OrchestratedStatus;
    tenantId: string;
    problem: string;
    financial: {
        profit: number;
        profitMargin: number;
        debtRatio: number;
        npv: number;
        irr: number;
        paybackPeriod: number;
        wacc: number;
        status: "READY" | "BLOCKED";
    };
    risk: {
        score: number;
        tornado: { variable: string; range: number }[];
        status: "READY" | "BLOCKED";
    };
    decision: {
        ahp: { weights: number[]; consistent: boolean; consistencyRatio: number; status: "READY" | "BLOCKED" };
        topsis: { scores: number[]; bestIndex: number; status: "READY" | "BLOCKED" };
        decisionTree?: { expectedValue: number; status: "READY" | "BLOCKED" };
        execution: {
            status: OrchestratedStatus;
            methods: readonly DecisionMethodId[];
            blockedMethods: readonly DecisionMethodId[];
        };
        status: OrchestratedStatus;
    };
    /** Null only when the request is rejected before science routing. */
    science: ScienceSelectionPlan | null;
    quality: DecisionQualityReport;
}

const BASELINE_SCIENCE_SIGNALS: readonly ScienceSignal[] = Object.freeze([
    "financial-performance",
    "cash-flow",
    "risk-assessment",
    "multi-criteria-decision"
]);

function buildInputFingerprint(input?: OrchestratedInput): string {
    const material = input ? {
        tenantId: input.tenantId,
        problem: input.problem,
        financial: input.financial,
        risk: input.risk ? {
            probability: input.risk.probability,
            impact: input.risk.impact,
            criteria: input.risk.criteria,
            modelSource: typeof input.risk.model === "function" ? String(input.risk.model) : "unavailable"
        } : null,
        decision: input.decision,
        additionalScienceSignals: input.additionalScienceSignals
    } : null;

    return ProvenanceTrace.hashInput(JSON.stringify(material));
}

function buildQualityReport(
    inputHash: string,
    outputMaterial: unknown,
    checks: readonly DecisionQualityCheck[],
    reasoningSteps: readonly string[]
): DecisionQualityReport {
    const blocked = checks.some(check => check.status === "BLOCKED");
    const reviewRequired = checks.some(check => check.status === "REVIEW_REQUIRED");
    const status: DecisionQualityCheckStatus = blocked
        ? "BLOCKED"
        : reviewRequired
            ? "REVIEW_REQUIRED"
            : "PASS";

    return {
        status,
        requiresHumanReview: status !== "PASS",
        checks: checks.map(check => ({ ...check })),
        provenance: {
            traceId: ProvenanceTrace.createTraceId(),
            sourceRef: "Backend/HBOS/Product/OrchestratedDecisionIntelligenceService",
            timestamp: new Date().toISOString(),
            inputHash,
            outputHash: ProvenanceTrace.hashInput(JSON.stringify(outputMaterial)),
            verificationStatus: status === "PASS"
                ? "VERIFIED"
                : status === "REVIEW_REQUIRED"
                    ? "PENDING"
                    : "FAILED",
            reasoningSteps: [...reasoningSteps]
        }
    };
}

function blockedAhp(): AhpResult {
    return {
        method: "ahp",
        criteriaCount: 0,
        weights: [],
        lambdaMax: 0,
        consistencyIndex: 0,
        consistencyRatio: 0,
        consistent: false,
        status: "BLOCKED"
    };
}

function blockedTopsis(): TopsisResult {
    return {
        method: "topsis",
        alternativeCount: 0,
        criteriaCount: 0,
        scores: [],
        bestIndex: -1,
        status: "BLOCKED"
    };
}

function blockedDecisionTree(): DecisionTreeResult {
    return { method: "decisionTree", expectedValue: 0, status: "BLOCKED" };
}

export class OrchestratedDecisionIntelligenceService {
    private readonly fin: FinancialIntelligenceEngine;
    private readonly risk: RiskIntelligenceEngine;
    private readonly dec: DecisionIntelligenceEngine;
    private readonly knowledge: KnowledgeEngine;

    constructor(
        fin?: FinancialIntelligenceEngine,
        risk?: RiskIntelligenceEngine,
        dec?: DecisionIntelligenceEngine,
        knowledge?: KnowledgeEngine
    ) {
        this.fin = fin ?? new FinancialIntelligenceEngine();
        this.risk = risk ?? new RiskIntelligenceEngine();
        this.dec = dec ?? new DecisionIntelligenceEngine();
        this.knowledge = knowledge ?? new KnowledgeEngine();
    }

    orchestrate(input: OrchestratedInput): OrchestratedResult {
        if (
            !input ||
            typeof input.tenantId !== "string" ||
            !input.tenantId.trim() ||
            !input.financial ||
            !input.risk ||
            !input.decision ||
            typeof input.risk.model !== "function"
        ) {
            return this.blocked(input, "A valid tenant, financial/risk/decision payload and risk model are required.");
        }

        const inputHash = buildInputFingerprint(input);

        // Science selection comes from the workflow's typed domains and
        // optional explicit signals, never from guesses about the free text.
        const scienceSignals = Array.from(new Set([
            ...BASELINE_SCIENCE_SIGNALS,
            ...(input.additionalScienceSignals ?? [])
        ]));
        const science = this.knowledge.planScienceSelection({
            signals: scienceSignals,
            includeCrossCuttingGuardrails: true
        });

        // Financial calculations remain owned by FinancialIntelligenceEngine.
        const fin = this.fin.analyze({
            revenue: input.financial.revenue,
            expenses: input.financial.expenses,
            assets: input.financial.assets,
            liabilities: input.financial.liabilities
        });
        const npv = this.fin.npv(input.financial.cashFlows);
        const irr = this.fin.irr(input.financial.cashFlows);
        const pay = this.fin.payback(input.financial.cashFlows);
        const wacc = this.fin.wacc(input.financial.waccInputs);
        const finReady =
            fin.status === "READY" &&
            npv.status === "READY" &&
            irr.status === "READY" &&
            pay.status === "READY" &&
            wacc.status === "READY";

        // Risk calculations remain owned by RiskIntelligenceEngine.
        const risk = this.risk.assess(input.risk.probability, input.risk.impact);
        const tornado = this.risk.tornado({
            base: input.risk.criteria
                ? Object.fromEntries(input.risk.criteria.map(c => [c.name, c.params["value"] ?? 0]))
                : { x: 0 },
            deltaPct: 0.10,
            model: input.risk.model
        });

        // The nervous-system-facing execution record carries exactly which
        // existing methods ran and which blocked. It never fabricates inputs.
        const decisionExecution = this.dec.executeAvailableMethods({
            ahp: { matrix: input.decision.ahpMatrix },
            topsis: input.decision.topsis,
            ...(input.decision.decisionTree !== undefined
                ? { decisionTree: input.decision.decisionTree }
                : {})
        });
        const ahpItem = decisionExecution.results.find(item => item.method === "ahp");
        const topsisItem = decisionExecution.results.find(item => item.method === "topsis");
        const treeItem = decisionExecution.results.find(item => item.method === "decisionTree");
        const ahp = ahpItem?.result.method === "ahp" ? ahpItem.result : blockedAhp();
        const topsis = topsisItem?.result.method === "topsis" ? topsisItem.result : blockedTopsis();
        const decisionTree = treeItem?.result.method === "decisionTree" ? treeItem.result : undefined;

        const qualityChecks: DecisionQualityCheck[] = [
            {
                id: "tenant-scope",
                status: "PASS",
                detail: "A non-empty tenant scope was supplied and is propagated unchanged."
            },
            {
                id: "financial-calculations",
                status: finReady ? "PASS" : "BLOCKED",
                detail: finReady
                    ? "All required financial calculations returned READY."
                    : "At least one required financial calculation is blocked; inspect the financial sub-results."
            },
            {
                id: "risk-calculations",
                status: risk.status === "READY" ? "PASS" : "BLOCKED",
                detail: risk.status === "READY"
                    ? "Risk probability/impact assessment returned READY."
                    : "Risk probability or impact failed its input contract."
            },
            {
                id: "decision-method-composition",
                status: decisionExecution.status === "READY"
                    ? "PASS"
                    : decisionExecution.status === "PARTIAL"
                        ? "REVIEW_REQUIRED"
                        : "BLOCKED",
                detail: decisionExecution.note
            },
            {
                id: "science-selection",
                status: science.status === "READY"
                    ? "PASS"
                    : science.status === "PARTIAL"
                        ? "REVIEW_REQUIRED"
                        : "BLOCKED",
                detail: science.note
            },
            {
                id: "source-data-quality",
                status: "REVIEW_REQUIRED",
                detail: "This service receives structured metrics but no source-observation quality profile; upstream ingestion/data-quality evidence still requires review."
            }
        ];

        const executionStatus: OrchestratedStatus =
            finReady && risk.status === "READY" && decisionExecution.status === "READY"
                ? "READY"
                : decisionExecution.status === "PARTIAL" && finReady && risk.status === "READY"
                    ? "PARTIAL"
                    : "BLOCKED";

        const qualityStatus = qualityChecks.some(check => check.status === "BLOCKED")
            ? "BLOCKED"
            : qualityChecks.some(check => check.status === "REVIEW_REQUIRED")
                ? "PARTIAL"
                : "READY";
        const status: OrchestratedStatus = qualityStatus;

        const core = {
            executionStatus,
            status,
            tenantId: input.tenantId,
            problem: input.problem,
            financial: {
                profit: fin.profit,
                profitMargin: fin.profitMargin,
                debtRatio: fin.debtRatio,
                npv: npv.npv,
                irr: irr.irr,
                paybackPeriod: pay.paybackPeriod,
                wacc: wacc.wacc,
                status: finReady ? "READY" as const : "BLOCKED" as const
            },
            risk: {
                score: risk.score,
                tornado: tornado.map(t => ({ variable: t.variable, range: t.range })),
                status: risk.status
            },
            decision: {
                ahp: {
                    weights: ahp.weights,
                    consistent: ahp.consistent,
                    consistencyRatio: ahp.consistencyRatio,
                    status: ahp.status
                },
                topsis: {
                    scores: topsis.scores,
                    bestIndex: topsis.bestIndex,
                    status: topsis.status
                },
                ...(decisionTree
                    ? { decisionTree: { expectedValue: decisionTree.expectedValue, status: decisionTree.status } }
                    : {}),
                execution: {
                    status: decisionExecution.status,
                    methods: [...decisionExecution.executedMethods],
                    blockedMethods: [...decisionExecution.blockedMethods]
                },
                status: decisionExecution.status
            },
            science
        };

        const quality = buildQualityReport(
            inputHash,
            core,
            qualityChecks,
            [
                "Validated tenant and structured decision input.",
                "Executed financial and risk methods through their existing canonical owners.",
                "Executed decision methods through DecisionIntelligenceEngine.executeAvailableMethods.",
                "Selected science domains from structured workflow signals and explicit supplemental signals.",
                "Applied the quality gate; missing source-data quality evidence remains REVIEW_REQUIRED."
            ]
        );

        return { ...core, quality };
    }

    private blocked(input: OrchestratedInput | undefined, reason: string): OrchestratedResult {
        const tenantId = typeof input?.tenantId === "string" ? input.tenantId : "";
        const problem = typeof input?.problem === "string" ? input.problem : "";
        const core = {
            executionStatus: "BLOCKED" as const,
            status: "BLOCKED" as const,
            tenantId,
            problem,
            financial: {
                profit: 0,
                profitMargin: 0,
                debtRatio: 0,
                npv: 0,
                irr: 0,
                paybackPeriod: Number.NaN,
                wacc: 0,
                status: "BLOCKED" as const
            },
            risk: { score: 0, tornado: [], status: "BLOCKED" as const },
            decision: {
                ahp: { weights: [], consistent: false, consistencyRatio: 0, status: "BLOCKED" as const },
                topsis: { scores: [], bestIndex: -1, status: "BLOCKED" as const },
                execution: { status: "BLOCKED" as const, methods: [] as DecisionMethodId[], blockedMethods: [] as DecisionMethodId[] },
                status: "BLOCKED" as const
            },
            science: null
        };
        const checks: DecisionQualityCheck[] = [
            { id: "request-contract", status: "BLOCKED", detail: reason },
            { id: "tenant-scope", status: "BLOCKED", detail: "A non-empty tenant scope is required." }
        ];
        const quality = buildQualityReport(
            buildInputFingerprint(input),
            core,
            checks,
            ["Rejected the request before method execution because a required input contract was not satisfied."]
        );
        return { ...core, quality };
    }
}
