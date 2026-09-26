import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";
import { RiskIntelligenceEngine } from "../Engines/RiskIntelligenceEngine";
import { DecisionIntelligenceEngine } from "../Engines/DecisionIntelligenceEngine";

/**
 * Phase 09-1.15: Orchestrated Decision Intelligence (product service).
 *
 * Composition owner over the canonical Engines. The AssistantEngine can call
 * this service to obtain a unified decision-intelligence summary without
 * re-deriving math. The service is purely deterministic; AI / reasoning
 * remains interpretation only.
 *
 * Tenant isolation: tenantId is propagated through the call chain so the
 * product-layer can persist results against the canonical persistence
 * boundary. The service itself does not store tenant data.
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
    };
}

export interface OrchestratedResult {
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
        status: "READY" | "BLOCKED";
    };
    status: "READY" | "BLOCKED";
}

export class OrchestratedDecisionIntelligenceService {
    private readonly fin: FinancialIntelligenceEngine;
    private readonly risk: RiskIntelligenceEngine;
    private readonly dec: DecisionIntelligenceEngine;

    constructor(fin?: FinancialIntelligenceEngine, risk?: RiskIntelligenceEngine, dec?: DecisionIntelligenceEngine) {
        this.fin = fin ?? new FinancialIntelligenceEngine();
        this.risk = risk ?? new RiskIntelligenceEngine();
        this.dec = dec ?? new DecisionIntelligenceEngine();
    }

    orchestrate(input: OrchestratedInput): OrchestratedResult {
        const blocked = (): OrchestratedResult => ({
            tenantId: input?.tenantId ?? "",
            problem: input?.problem ?? "",
            financial: { profit: 0, profitMargin: 0, debtRatio: 0, npv: 0, irr: 0, paybackPeriod: NaN, wacc: 0, status: "BLOCKED" },
            risk: { score: 0, tornado: [], status: "BLOCKED" },
            decision: {
                ahp: { weights: [], consistent: false, consistencyRatio: 0, status: "BLOCKED" },
                topsis: { scores: [], bestIndex: -1, status: "BLOCKED" },
                status: "BLOCKED"
            },
            status: "BLOCKED"
        });
        if (!input || typeof input.tenantId !== "string" || !input.tenantId.trim()) {
            return blocked();
        }
        // Financial
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
        const finReady = fin.status === "READY" && npv.status === "READY" && irr.status === "READY" && pay.status === "READY" && wacc.status === "READY";
        // Risk
        const risk = this.risk.assess(input.risk.probability, input.risk.impact);
        const tornado = this.risk.tornado({
            base: input.risk.criteria ? Object.fromEntries(input.risk.criteria.map(c => [c.name, c.params["value"] ?? 0])) : { x: 0 },
            deltaPct: 0.10,
            model: input.risk.model
        });
        // Decision
        const ahp = this.dec.ahp({ matrix: input.decision.ahpMatrix });
        const topsis = this.dec.topsis(input.decision.topsis);
        const decReady = ahp.status === "READY" && topsis.status === "READY";

        return {
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
                status: finReady ? "READY" : "BLOCKED"
            },
            risk: {
                score: risk.score,
                tornado: tornado.map(t => ({ variable: t.variable, range: t.range })),
                status: risk.status
            },
            decision: {
                ahp: { weights: ahp.weights, consistent: ahp.consistent, consistencyRatio: ahp.consistencyRatio, status: ahp.status },
                topsis: { scores: topsis.scores, bestIndex: topsis.bestIndex, status: topsis.status },
                status: decReady ? "READY" : "BLOCKED"
            },
            status: finReady && decReady && risk.status === "READY" ? "READY" : "BLOCKED"
        };
    }
}
