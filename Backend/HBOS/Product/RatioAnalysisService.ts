/**
 * Phase 09-1.13: Financial Statement Ratio Analysis (product service).
 *
 * Computes horizontal (period-over-period change) and vertical (% of base
 * column) analyses, plus standard ratios. Composition owner over the
 * canonical FinancialIntelligenceEngine. No new Engine.
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

export interface VerticalAnalysisRow {
    line: string;
    amount: number;
    pct: number;
}

export interface VerticalAnalysisResult {
    base: string;
    rows: VerticalAnalysisRow[];
    status: "READY" | "BLOCKED";
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
}

export class RatioAnalysisService {
    private validateStatement(s: RatioStatement | undefined | null): boolean {
        if (!s) return false;
        const fields: (keyof RatioStatement)[] = [
            "revenue", "cogs", "grossProfit", "operatingExpenses", "operatingIncome",
            "interest", "preTaxIncome", "taxes", "netIncome",
            "cash", "receivables", "inventory", "currentAssets", "ppe", "totalAssets",
            "payables", "shortTermDebt", "currentLiabilities", "longTermDebt",
            "totalLiabilities", "equity"
        ];
        for (const f of fields) {
            if (!Number.isFinite(s[f])) return false;
            if ((s[f] as number) < 0) return false;
        }
        return true;
    }

    vertical(statement: RatioStatement, base: "revenue" | "totalAssets" = "revenue"): VerticalAnalysisResult {
        if (!this.validateStatement(statement)) {
            return { base, rows: [], status: "BLOCKED" };
        }
        const denom = base === "revenue" ? statement.revenue : statement.totalAssets;
        if (denom === 0) {
            return { base, rows: [], status: "BLOCKED" };
        }
        const items: { line: string; amount: number }[] = base === "revenue"
            ? [
                { line: "revenue", amount: statement.revenue },
                { line: "cogs", amount: statement.cogs },
                { line: "grossProfit", amount: statement.grossProfit },
                { line: "operatingExpenses", amount: statement.operatingExpenses },
                { line: "operatingIncome", amount: statement.operatingIncome },
                { line: "interest", amount: statement.interest },
                { line: "preTaxIncome", amount: statement.preTaxIncome },
                { line: "taxes", amount: statement.taxes },
                { line: "netIncome", amount: statement.netIncome }
            ]
            : [
                { line: "cash", amount: statement.cash },
                { line: "receivables", amount: statement.receivables },
                { line: "inventory", amount: statement.inventory },
                { line: "currentAssets", amount: statement.currentAssets },
                { line: "ppe", amount: statement.ppe },
                { line: "totalAssets", amount: statement.totalAssets },
                { line: "payables", amount: statement.payables },
                { line: "shortTermDebt", amount: statement.shortTermDebt },
                { line: "currentLiabilities", amount: statement.currentLiabilities },
                { line: "longTermDebt", amount: statement.longTermDebt },
                { line: "totalLiabilities", amount: statement.totalLiabilities },
                { line: "equity", amount: statement.equity }
            ];
        const rows = items.map(it => ({ line: it.line, amount: it.amount, pct: it.amount / denom }));
        return { base, rows, status: "READY" };
    }

    horizontal(current: RatioStatement, prior: RatioStatement): HorizontalAnalysisResult {
        if (!this.validateStatement(current) || !this.validateStatement(prior)) {
            return { entries: [], status: "BLOCKED" };
        }
        const lines: (keyof RatioStatement)[] = [
            "revenue", "cogs", "grossProfit", "operatingExpenses", "operatingIncome",
            "interest", "preTaxIncome", "taxes", "netIncome",
            "totalAssets", "totalLiabilities", "equity"
        ];
        const entries: HorizontalAnalysisEntry[] = lines.map(line => {
            const c = current[line];
            const p = prior[line];
            return {
                line,
                current: c,
                prior: p,
                absoluteChange: c - p,
                pctChange: p === 0 ? 0 : (c - p) / p
            };
        });
        return { entries, status: "READY" };
    }

    profitability(statement: RatioStatement): { grossMargin: number; operatingMargin: number; netMargin: number; roa: number; roe: number; status: "READY" | "BLOCKED" } {
        if (!this.validateStatement(statement) || statement.revenue === 0 || statement.totalAssets === 0 || statement.equity === 0) {
            return { grossMargin: 0, operatingMargin: 0, netMargin: 0, roa: 0, roe: 0, status: "BLOCKED" };
        }
        return {
            grossMargin: statement.grossProfit / statement.revenue,
            operatingMargin: statement.operatingIncome / statement.revenue,
            netMargin: statement.netIncome / statement.revenue,
            roa: statement.netIncome / statement.totalAssets,
            roe: statement.netIncome / statement.equity,
            status: "READY"
        };
    }

    leverage(statement: RatioStatement): { debtToEquity: number; debtToAssets: number; equityRatio: number; status: "READY" | "BLOCKED" } {
        if (!this.validateStatement(statement) || statement.totalAssets === 0) {
            return { debtToEquity: 0, debtToAssets: 0, equityRatio: 0, status: "BLOCKED" };
        }
        return {
            debtToEquity: statement.equity === 0 ? 0 : statement.totalLiabilities / statement.equity,
            debtToAssets: statement.totalLiabilities / statement.totalAssets,
            equityRatio: statement.equity / statement.totalAssets,
            status: "READY"
        };
    }
}
