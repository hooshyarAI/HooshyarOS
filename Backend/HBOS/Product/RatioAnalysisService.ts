/**
 * Phase 09-1.13: Financial Statement Ratio Analysis (product service).
 *
 * Computes horizontal (period-over-period change) and vertical (% of base
 * column) analyses, plus standard ratios. Composition owner over the
 * canonical FinancialIntelligenceEngine. No new Engine.
 *
 * Partial statements are supported per-ratio: a ratio is returned only when
 * every input it needs is present and finite; ratios whose evidence is absent
 * are reported in `unavailable` and never fabricated. A present-but-invalid
 * value (non-finite or negative) still fails the whole statement closed.
 */

export interface RatioStatement {
    revenue: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    operatingIncome: number;
    interest: number;
    preTaxIncome: number;
    taxes: number;
    netIncome: number;
    cash: number;
    receivables: number;
    inventory: number;
    currentAssets: number;
    ppe: number;
    totalAssets: number;
    payables: number;
    shortTermDebt: number;
    currentLiabilities: number;
    longTermDebt: number;
    totalLiabilities: number;
    equity: number;
}

const INCOME_LINES: ReadonlyArray<keyof RatioStatement> = [
    "revenue", "cogs", "grossProfit", "operatingExpenses", "operatingIncome",
    "interest", "preTaxIncome", "taxes", "netIncome",
];

const BALANCE_LINES: ReadonlyArray<keyof RatioStatement> = [
    "cash", "receivables", "inventory", "currentAssets", "ppe", "totalAssets",
    "payables", "shortTermDebt", "currentLiabilities", "longTermDebt",
    "totalLiabilities", "equity",
];

const HORIZONTAL_LINES: ReadonlyArray<keyof RatioStatement> = [
    "revenue", "cogs", "grossProfit", "operatingExpenses", "operatingIncome",
    "interest", "preTaxIncome", "taxes", "netIncome",
    "totalAssets", "totalLiabilities", "equity",
];

const RATIO_STATEMENT_FIELDS: ReadonlyArray<keyof RatioStatement> = [
    ...INCOME_LINES, ...BALANCE_LINES,
];

export interface VerticalAnalysisRow {
    line: string;
    amount: number;
    pct: number;
}

export interface VerticalAnalysisResult {
    base: string;
    rows: VerticalAnalysisRow[];
    status: "READY" | "BLOCKED";
    /** Lines whose evidence was absent and were therefore not computed. */
    unavailable: string[];
}

export interface HorizontalAnalysisEntry {
    line: string;
    current: number;
    prior: number;
    absoluteChange: number;
    pctChange: number;
}

export interface HorizontalAnalysisResult {
    entries: HorizontalAnalysisEntry[];
    status: "READY" | "BLOCKED";
    /** Lines whose evidence was absent for either period and were not compared. */
    unavailable: string[];
}

export interface ProfitabilityResult {
    grossMargin: number | null;
    operatingMargin: number | null;
    netMargin: number | null;
    roa: number | null;
    roe: number | null;
    status: "READY" | "BLOCKED";
    unavailable: string[];
}

export interface LeverageResult {
    debtToEquity: number | null;
    debtToAssets: number | null;
    equityRatio: number | null;
    status: "READY" | "BLOCKED";
    unavailable: string[];
}

export interface LiquidityResult {
    currentRatio: number | null;
    quickRatio: number | null;
    cashRatio: number | null;
    status: "READY" | "BLOCKED";
    unavailable: string[];
}

export class RatioAnalysisService {
    /**
     * True when a field is present but is not a valid non-negative finite
     * magnitude. Explicit corruption (NaN, Infinity, negative) fails the whole
     * statement closed; an absent field only makes its own ratios unavailable.
     */
    private hasInvalidProvidedField(statement: Partial<RatioStatement> | undefined | null): boolean {
        if (!statement) return true;
        for (const field of RATIO_STATEMENT_FIELDS) {
            const value = (statement as Record<string, unknown>)[field];
            if (value === undefined) continue;
            if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return true;
        }
        return false;
    }

    private value(statement: Partial<RatioStatement>, field: keyof RatioStatement): number | null {
        const candidate = (statement as Record<string, unknown>)[field];
        return typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0 ? candidate : null;
    }

    private ratio(numerator: number | null, denominator: number | null): number | null {
        if (numerator === null || denominator === null || denominator === 0) return null;
        const result = numerator / denominator;
        return Number.isFinite(result) ? result : null;
    }

    vertical(statement: Partial<RatioStatement>, base: "revenue" | "totalAssets" = "revenue"): VerticalAnalysisResult {
        if (this.hasInvalidProvidedField(statement)) {
            return { base, rows: [], status: "BLOCKED", unavailable: [] };
        }
        const denom = this.value(statement, base);
        if (denom === null || denom === 0) {
            return { base, rows: [], status: "BLOCKED", unavailable: [base] };
        }
        const items = base === "revenue" ? INCOME_LINES : BALANCE_LINES;
        const rows: VerticalAnalysisRow[] = [];
        const unavailable: string[] = [];
        for (const line of items) {
            const amount = this.value(statement, line);
            if (amount === null) {
                unavailable.push(line);
                continue;
            }
            rows.push({ line, amount, pct: amount / denom });
        }
        return { base, rows, status: rows.length > 0 ? "READY" : "BLOCKED", unavailable };
    }

    horizontal(current: Partial<RatioStatement>, prior: Partial<RatioStatement>): HorizontalAnalysisResult {
        if (this.hasInvalidProvidedField(current) || this.hasInvalidProvidedField(prior)) {
            return { entries: [], status: "BLOCKED", unavailable: [] };
        }
        const entries: HorizontalAnalysisEntry[] = [];
        const unavailable: string[] = [];
        for (const line of HORIZONTAL_LINES) {
            const c = this.value(current, line);
            const p = this.value(prior, line);
            if (c === null || p === null) {
                unavailable.push(line);
                continue;
            }
            entries.push({
                line,
                current: c,
                prior: p,
                absoluteChange: c - p,
                pctChange: p === 0 ? 0 : (c - p) / p,
            });
        }
        return { entries, status: entries.length > 0 ? "READY" : "BLOCKED", unavailable };
    }

    profitability(statement: Partial<RatioStatement>): ProfitabilityResult {
        const unavailableAll = ["grossMargin", "operatingMargin", "netMargin", "roa", "roe"];
        if (this.hasInvalidProvidedField(statement)) {
            return { grossMargin: null, operatingMargin: null, netMargin: null, roa: null, roe: null, status: "BLOCKED", unavailable: unavailableAll };
        }
        const revenue = this.value(statement, "revenue");
        const grossProfit = this.value(statement, "grossProfit");
        const operatingIncome = this.value(statement, "operatingIncome");
        const netIncome = this.value(statement, "netIncome");
        const totalAssets = this.value(statement, "totalAssets");
        const equity = this.value(statement, "equity");

        const grossMargin = this.ratio(grossProfit, revenue);
        const operatingMargin = this.ratio(operatingIncome, revenue);
        const netMargin = this.ratio(netIncome, revenue);
        const roa = this.ratio(netIncome, totalAssets);
        const roe = this.ratio(netIncome, equity);
        const computed = { grossMargin, operatingMargin, netMargin, roa, roe };
        const unavailable = unavailableAll.filter((key) => computed[key as keyof typeof computed] === null);
        return { ...computed, status: unavailable.length < unavailableAll.length ? "READY" : "BLOCKED", unavailable };
    }

    leverage(statement: Partial<RatioStatement>): LeverageResult {
        const unavailableAll = ["debtToEquity", "debtToAssets", "equityRatio"];
        if (this.hasInvalidProvidedField(statement)) {
            return { debtToEquity: null, debtToAssets: null, equityRatio: null, status: "BLOCKED", unavailable: unavailableAll };
        }
        const totalAssets = this.value(statement, "totalAssets");
        const totalLiabilities = this.value(statement, "totalLiabilities");
        const equity = this.value(statement, "equity");

        const debtToEquity = this.ratio(totalLiabilities, equity);
        const debtToAssets = this.ratio(totalLiabilities, totalAssets);
        const equityRatio = this.ratio(equity, totalAssets);
        const computed = { debtToEquity, debtToAssets, equityRatio };
        const unavailable = unavailableAll.filter((key) => computed[key as keyof typeof computed] === null);
        return { ...computed, status: unavailable.length < unavailableAll.length ? "READY" : "BLOCKED", unavailable };
    }

    liquidity(statement: Partial<RatioStatement>): LiquidityResult {
        const unavailableAll = ["currentRatio", "quickRatio", "cashRatio"];
        if (this.hasInvalidProvidedField(statement)) {
            return { currentRatio: null, quickRatio: null, cashRatio: null, status: "BLOCKED", unavailable: unavailableAll };
        }
        const currentAssets = this.value(statement, "currentAssets");
        const currentLiabilities = this.value(statement, "currentLiabilities");
        const inventory = this.value(statement, "inventory");
        const cash = this.value(statement, "cash");
        const quickAssets = currentAssets !== null && inventory !== null && currentAssets >= inventory
            ? currentAssets - inventory
            : null;

        const currentRatio = this.ratio(currentAssets, currentLiabilities);
        const quickRatio = this.ratio(quickAssets, currentLiabilities);
        const cashRatio = this.ratio(cash, currentLiabilities);
        const computed = { currentRatio, quickRatio, cashRatio };
        const unavailable = unavailableAll.filter((key) => computed[key as keyof typeof computed] === null);
        return { ...computed, status: unavailable.length < unavailableAll.length ? "READY" : "BLOCKED", unavailable };
    }
}
