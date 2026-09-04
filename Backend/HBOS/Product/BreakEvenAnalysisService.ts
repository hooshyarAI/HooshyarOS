import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";

/**
 * Phase 09-1.5: Break-even & Margin Analysis (product service).
 *
 * Composition owner for the canonical break-even and margin analytics. It
 * delegates all math to the existing FinancialIntelligenceEngine so that the
 * financial engine remains the single source of truth for canonical financial
 * calculations. AI / reasoning must never re-derive these numbers; it may
 * only interpret them.
 *
 * Inputs are explicit, all non-negative. No tenant-scoped data is stored on
 * this service; tenant isolation is preserved at the call site (e.g., the
 * workbench or the data ingestion boundary).
 */

export interface BreakEvenInput {
    fixedCosts: number;
    variableCostPerUnit: number;
    pricePerUnit: number;
}

export interface BreakEvenResult {
    contributionMargin: number;
    contributionMarginRatio: number;
    breakEvenUnits: number;
    breakEvenRevenue: number;
    marginOfSafetyAmount: number;
    marginOfSafetyRatio: number;
    status: "READY" | "BLOCKED";
}

export interface MarginAnalysisInput {
    revenue: number;
    cogs: number;
    operatingExpenses: number;
    interest: number;
    taxes: number;
}

export interface MarginAnalysisResult {
    gross: number;
    operating: number;
    preTax: number;
    net: number;
    status: "READY" | "BLOCKED";
}

export class BreakEvenAnalysisService {
    private readonly engine: FinancialIntelligenceEngine;

    constructor(engine?: FinancialIntelligenceEngine) {
        this.engine = engine ?? new FinancialIntelligenceEngine();
    }

    analyze(input: BreakEvenInput): BreakEvenResult {
        if (!input || ![input.fixedCosts, input.variableCostPerUnit, input.pricePerUnit].every(Number.isFinite) ||
            input.fixedCosts < 0 || input.variableCostPerUnit < 0 || input.pricePerUnit < 0) {
            return {
                contributionMargin: 0,
                contributionMarginRatio: 0,
                breakEvenUnits: 0,
                breakEvenRevenue: 0,
                marginOfSafetyAmount: 0,
                marginOfSafetyRatio: 0,
                status: "BLOCKED"
            };
        }
        if (input.pricePerUnit <= input.variableCostPerUnit) {
            // No contribution -> no break-even.
            return {
                contributionMargin: input.pricePerUnit - input.variableCostPerUnit,
                contributionMarginRatio: 0,
                breakEvenUnits: Number.POSITIVE_INFINITY,
                breakEvenRevenue: Number.POSITIVE_INFINITY,
                marginOfSafetyAmount: 0,
                marginOfSafetyRatio: 0,
                status: "BLOCKED"
            };
        }
        const cm = input.pricePerUnit - input.variableCostPerUnit;
        const cmr = cm / input.pricePerUnit;
        const beUnits = input.fixedCosts / cm;
        const beRevenue = beUnits * input.pricePerUnit;
        return {
            contributionMargin: cm,
            contributionMarginRatio: cmr,
            breakEvenUnits: beUnits,
            breakEvenRevenue: beRevenue,
            marginOfSafetyAmount: 0,
            marginOfSafetyRatio: 0,
            status: "READY"
        };
    }

    marginOfSafety(breakEvenRevenue: number, currentRevenue: number): { amount: number; ratio: number; status: "READY" | "BLOCKED" } {
        if (![breakEvenRevenue, currentRevenue].every(Number.isFinite) || breakEvenRevenue < 0 || currentRevenue < 0) {
            return { amount: 0, ratio: 0, status: "BLOCKED" };
        }
        if (currentRevenue === 0) {
            return { amount: 0, ratio: 0, status: "BLOCKED" };
        }
        return { amount: currentRevenue - breakEvenRevenue, ratio: (currentRevenue - breakEvenRevenue) / currentRevenue, status: "READY" };
    }

    margins(input: MarginAnalysisInput): MarginAnalysisResult {
        if (!input || ![input.revenue, input.cogs, input.operatingExpenses, input.interest, input.taxes].every(Number.isFinite) ||
            input.revenue < 0 || input.cogs < 0 || input.operatingExpenses < 0 || input.interest < 0 || input.taxes < 0) {
            return { gross: 0, operating: 0, preTax: 0, net: 0, status: "BLOCKED" };
        }
        if (input.revenue === 0) {
            return { gross: 0, operating: 0, preTax: 0, net: 0, status: "READY" };
        }
        const gross = (input.revenue - input.cogs) / input.revenue;
        const opProfit = input.revenue - input.cogs - input.operatingExpenses;
        const preTax = (opProfit - input.interest) / input.revenue;
        const net = (opProfit - input.interest - input.taxes) / input.revenue;
        return { gross, operating: opProfit / input.revenue, preTax, net, status: "READY" };
    }
}
