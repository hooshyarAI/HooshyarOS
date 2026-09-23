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
 * value still fails the whole statement closed.
 *
 * Signed-value semantics (V2): legitimate statement measures may be negative
 * (gross/operating/pre-tax/net loss, negative equity, negative cash flows).
 * Only `SIGNED_FIELDS` may carry a negative value; every other field is a
 * magnitude whose negative value is corruption and fails closed. A ratio whose
 * derived result is undefined for a semantic reason (non-positive equity for
 * debt/equity or ROE, non-positive current liabilities for the current ratio)
 * is reported in `notApplicable` — never silently dropped and never computed
 * with a misleading denominator. Percentage change is `null` when the prior
 * value is zero or when the sign reverses, and the absolute change is always
 * preserved.
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

/**
 * Fields whose real accounting value may legitimately be negative: losses
 * (gross/operating/pre-tax/net), accumulated-loss equity, and items that are
 * net presentations (interest, taxes as a benefit). Every other statement
 * field is a magnitude and a negative value is corruption.
 */
const SIGNED_FIELDS: ReadonlySet<keyof RatioStatement> = new Set<keyof RatioStatement>([
    "grossProfit", "operatingIncome", "preTaxIncome", "netIncome", "interest", "taxes", "equity",
]);

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
    /**
     * Period-over-period percentage change. `null` when it is mathematically
     * undefined (`prior === 0`) or financially misleading (sign reversal); the
     * absolute change is always preserved.
     */
    pctChange: number | null;
    /** True when the line crossed zero between the prior and current period. */
    signReversal: boolean;
    /** Precise reason `pctChange` is null (for honest interpretation). */
    pctChangeUnavailableReason?: "prior-value-zero" | "sign-reversal";
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
    /** Ratios whose evidence was absent. */
    unavailable: string[];
    /** Ratios whose evidence exists but the ratio is financially undefined (with reason). */
    notApplicable: string[];
}

export interface LeverageResult {
    debtToEquity: number | null;
    debtToAssets: number | null;
    equityRatio: number | null;
    status: "READY" | "BLOCKED";
    unavailable: string[];
    notApplicable: string[];
}

export interface LiquidityResult {
    currentRatio: number | null;
    quickRatio: number | null;
    cashRatio: number | null;
    status: "READY" | "BLOCKED";
    unavailable: string[];
    notApplicable: string[];
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
            if (typeof value !== "number" || !Number.isFinite(value)) return true;
            // A negative value is legitimate only for a signed statement measure;
            // for a magnitude field it is corruption and fails closed.
            if (value < 0 && !SIGNED_FIELDS.has(field)) return true;
        }
        return false;
    }

    private value(statement: Partial<RatioStatement>, field: keyof RatioStatement): number | null {
        const candidate = (statement as Record<string, unknown>)[field];
        if (typeof candidate !== "number" || !Number.isFinite(candidate)) return null;
        if (candidate < 0 && !SIGNED_FIELDS.has(field)) return null;
        return candidate;
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
            const signReversal = (p < 0 && c >= 0) || (p > 0 && c < 0);
            // A zero prior base makes the percentage mathematically undefined; a
            // sign reversal makes a single percentage misleading. In both cases
            // the percentage is honestly unavailable and the absolute change is
            // kept. A negative prior base (without reversal) uses its magnitude so
            // the change direction is still truthful.
            const pctChange = p === 0 ? null : signReversal ? null : (c - p) / Math.abs(p);
            entries.push({
                line,
                current: c,
                prior: p,
                absoluteChange: c - p,
                pctChange,
                signReversal,
                ...(pctChange === null
                    ? { pctChangeUnavailableReason: p === 0 ? "prior-value-zero" as const : "sign-reversal" as const }
                    : {}),
            });
        }
        return { entries, status: entries.length > 0 ? "READY" : "BLOCKED", unavailable };
    }

    profitability(statement: Partial<RatioStatement>): ProfitabilityResult {
        const unavailableAll = ["grossMargin", "operatingMargin", "netMargin", "roa", "roe"];
        if (this.hasInvalidProvidedField(statement)) {
            return { grossMargin: null, operatingMargin: null, netMargin: null, roa: null, roe: null, status: "BLOCKED", unavailable: unavailableAll, notApplicable: [] };
        }
        const revenue = this.value(statement, "revenue");
        const grossProfit = this.value(statement, "grossProfit");
        const operatingIncome = this.value(statement, "operatingIncome");
        const netIncome = this.value(statement, "netIncome");
        const totalAssets = this.value(statement, "totalAssets");
        const rawEquity = (statement as Record<string, unknown>).equity;
        const equity = typeof rawEquity === "number" && Number.isFinite(rawEquity) ? rawEquity : null;

        // Losses legitimately produce negative margins/returns; a non-positive
        // equity makes ROE undefined rather than a misleading signed quotient.
        const grossMargin = this.ratio(grossProfit, revenue);
        const operatingMargin = this.ratio(operatingIncome, revenue);
        const netMargin = this.ratio(netIncome, revenue);
        const roa = this.ratio(netIncome, totalAssets);
        const roe = equity !== null && equity > 0 ? this.ratio(netIncome, equity) : null;
        const computed = { grossMargin, operatingMargin, netMargin, roa, roe };
        const notApplicable = roe === null && equity !== null && equity <= 0 && netIncome !== null
            ? ["roe:equity-non-positive"]
            : [];
        const notApplicableKeys = new Set(notApplicable.map((reason) => reason.split(":")[0]));
        const unavailable = unavailableAll.filter(
            (key) => computed[key as keyof typeof computed] === null && !notApplicableKeys.has(key),
        );
        const status = Object.values(computed).some((value) => value !== null) ? "READY" : "BLOCKED";
        return { ...computed, status, unavailable, notApplicable };
    }

    leverage(statement: Partial<RatioStatement>): LeverageResult {
        const unavailableAll = ["debtToEquity", "debtToAssets", "equityRatio"];
        if (this.hasInvalidProvidedField(statement)) {
            return { debtToEquity: null, debtToAssets: null, equityRatio: null, status: "BLOCKED", unavailable: unavailableAll, notApplicable: [] };
        }
        const totalAssets = this.value(statement, "totalAssets");
        const totalLiabilities = this.value(statement, "totalLiabilities");
        const rawEquity = (statement as Record<string, unknown>).equity;
        const equity = typeof rawEquity === "number" && Number.isFinite(rawEquity) ? rawEquity : null;

        // Debt/equity is not meaningful when equity is zero or negative: a signed
        // quotient would invert its economic meaning. Report it as not applicable
        // with a precise reason instead of a fabricated number.
        const debtToEquity = equity !== null && equity > 0 ? this.ratio(totalLiabilities, equity) : null;
        const debtToAssets = this.ratio(totalLiabilities, totalAssets);
        // Equity/assets may legitimately be negative when equity is negative.
        const equityRatio = this.ratio(equity, totalAssets);
        const computed = { debtToEquity, debtToAssets, equityRatio };
        const notApplicable = debtToEquity === null && equity !== null && equity <= 0
            ? ["debtToEquity:equity-non-positive"]
            : [];
        const notApplicableKeys = new Set(notApplicable.map((reason) => reason.split(":")[0]));
        const unavailable = unavailableAll.filter(
            (key) => computed[key as keyof typeof computed] === null && !notApplicableKeys.has(key),
        );
        const status = Object.values(computed).some((value) => value !== null) ? "READY" : "BLOCKED";
        return { ...computed, status, unavailable, notApplicable };
    }

    liquidity(statement: Partial<RatioStatement>): LiquidityResult {
        const unavailableAll = ["currentRatio", "quickRatio", "cashRatio"];
        if (this.hasInvalidProvidedField(statement)) {
            return { currentRatio: null, quickRatio: null, cashRatio: null, status: "BLOCKED", unavailable: unavailableAll, notApplicable: [] };
        }
        const currentAssets = this.value(statement, "currentAssets");
        const currentLiabilities = this.value(statement, "currentLiabilities");
        const inventory = this.value(statement, "inventory");
        const cash = this.value(statement, "cash");
        const quickAssets = currentAssets !== null && inventory !== null && currentAssets >= inventory
            ? currentAssets - inventory
            : null;

        // A non-positive current-liability base makes every liquidity ratio
        // undefined; do not divide by it.
        const liquidityBase = currentLiabilities !== null && currentLiabilities > 0 ? currentLiabilities : null;
        const currentRatio = this.ratio(currentAssets, liquidityBase);
        const quickRatio = this.ratio(quickAssets, liquidityBase);
        const cashRatio = this.ratio(cash, liquidityBase);
        const computed = { currentRatio, quickRatio, cashRatio };
        const notApplicable = currentLiabilities !== null && currentLiabilities <= 0
            ? ["currentRatio:current-liabilities-non-positive", "quickRatio:current-liabilities-non-positive", "cashRatio:current-liabilities-non-positive"]
            : [];
        const notApplicableKeys = new Set(notApplicable.map((reason) => reason.split(":")[0]));
        const unavailable = unavailableAll.filter(
            (key) => computed[key as keyof typeof computed] === null && !notApplicableKeys.has(key),
        );
        const status = Object.values(computed).some((value) => value !== null) ? "READY" : "BLOCKED";
        return { ...computed, status, unavailable, notApplicable };
    }
}
