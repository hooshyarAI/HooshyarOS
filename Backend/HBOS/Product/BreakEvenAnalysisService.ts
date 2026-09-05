export interface BreakEvenAnalysisInput {
    fixedCosts: number;
    variableCostPerUnit: number;
    pricePerUnit: number;
    unitsSold: number;
}

export interface BreakEvenResult {
    breakEvenUnits: number;
    breakEvenRevenue: number;
    contributionMargin: number;
    contributionMarginRatio: number;
    marginOfSafety: number;
    marginOfSafetyRatio: number;
    status: "READY" | "BLOCKED";
}

export interface MarginOfSafetyResult {
    marginOfSafety: number;
    marginOfSafetyRatio: number;
}

export interface MarginsInput {
    revenue: number;
    cogs: number;
    operatingExpenses: number;
    netIncome: number;
}

export interface MarginsResult {
    grossMargin: number;
    grossMarginRatio: number;
    operatingMargin: number;
    operatingMarginRatio: number;
    netMargin: number;
    netMarginRatio: number;
}

export class BreakEvenAnalysisService {
    readonly capabilityId = "product.break-even-analysis";
    readonly targetEngine = "Financial Intelligence Engine";

    initialize(): { status: "READY" } {
        return { status: "READY" };
    }

    analyze(input: BreakEvenAnalysisInput): BreakEvenResult {
        if (!this.isFiniteInput(input)) {
            return this.blocked();
        }
        if (input.pricePerUnit <= 0 || input.variableCostPerUnit < 0 || input.fixedCosts < 0) {
            return this.blocked();
        }
        const contributionMargin = input.pricePerUnit - input.variableCostPerUnit;
        if (contributionMargin <= 0) {
            return this.blocked();
        }
        const breakEvenUnits = input.fixedCosts / contributionMargin;
        const breakEvenRevenue = breakEvenUnits * input.pricePerUnit;
        const contributionMarginRatio = contributionMargin / input.pricePerUnit;
        const marginOfSafety = input.unitsSold - breakEvenUnits;
        const marginOfSafetyRatio = input.unitsSold === 0 ? 0 : marginOfSafety / input.unitsSold;

        return {
            breakEvenUnits: this.round(breakEvenUnits),
            breakEvenRevenue: this.round(breakEvenRevenue),
            contributionMargin: this.round(contributionMargin),
            contributionMarginRatio: this.round(contributionMarginRatio),
            marginOfSafety: this.round(marginOfSafety),
            marginOfSafetyRatio: this.round(marginOfSafetyRatio),
            status: "READY",
        };
    }

    marginOfSafety(actualUnits: number, breakEvenUnits: number): MarginOfSafetyResult {
        if (!Number.isFinite(actualUnits) || !Number.isFinite(breakEvenUnits) || actualUnits < 0 || breakEvenUnits < 0) {
            return { marginOfSafety: 0, marginOfSafetyRatio: 0 };
        }
        const margin = actualUnits - breakEvenUnits;
        const ratio = actualUnits === 0 ? 0 : margin / actualUnits;
        return { marginOfSafety: this.round(margin), marginOfSafetyRatio: this.round(ratio) };
    }

    margins(input: MarginsInput): MarginsResult {
        if (!this.isFiniteInput(input)) {
            return {
                grossMargin: 0, grossMarginRatio: 0,
                operatingMargin: 0, operatingMarginRatio: 0,
                netMargin: 0, netMarginRatio: 0,
            };
        }
        if (input.revenue <= 0) {
            return {
                grossMargin: 0, grossMarginRatio: 0,
                operatingMargin: 0, operatingMarginRatio: 0,
                netMargin: 0, netMarginRatio: 0,
            };
        }
        const grossMargin = input.revenue - input.cogs;
        const operatingMargin = grossMargin - input.operatingExpenses;
        const grossMarginRatio = grossMargin / input.revenue;
        const operatingMarginRatio = operatingMargin / input.revenue;
        const netMarginRatio = input.netIncome / input.revenue;

        return {
            grossMargin: this.round(grossMargin),
            grossMarginRatio: this.round(grossMarginRatio),
            operatingMargin: this.round(operatingMargin),
            operatingMarginRatio: this.round(operatingMarginRatio),
            netMargin: this.round(input.netIncome),
            netMarginRatio: this.round(netMarginRatio),
        };
    }

    private isFiniteInput(input: unknown): boolean {
        if (!input || typeof input !== "object") return false;
        const values = Object.values(input as Record<string, unknown>);
        return values.every(v => typeof v === "number" && Number.isFinite(v));
    }

    private blocked(): BreakEvenResult {
        return {
            breakEvenUnits: 0,
            breakEvenRevenue: 0,
            contributionMargin: 0,
            contributionMarginRatio: 0,
            marginOfSafety: 0,
            marginOfSafetyRatio: 0,
            status: "BLOCKED",
        };
    }

    private round(value: number): number {
        return Math.round((value + Number.EPSILON) * 100) / 100;
    }
}
