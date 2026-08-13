export interface FinancialStatementInput {
    revenue: number;
    costOfGoodsSold: number;
    operatingExpenses: number;
    currentAssets: number;
    currentLiabilities: number;
    totalAssets: number;
    totalLiabilities: number;
    equity: number;
    cash?: number;
}

export interface FinancialStatementAnalysis {
    grossProfit: number;
    grossMargin: number;
    operatingProfit: number;
    operatingMargin: number;
    currentRatio: number;
    debtToEquity: number;
    returnOnAssets: number;
    warnings: string[];
    explanations: string[];
}

export interface ProductCapabilityResult {
    status: "READY" | "BLOCKED";
}

export class FinancialStatementAnalysisService {
    readonly capabilityId = "product.financial-statement-analysis";
    readonly targetEngine = "Financial Intelligence Engine";

    initialize(): { status: "READY" } {
        return { status: "READY" };
    }

    execute(input: string): ProductCapabilityResult {
        return { status: input && input.trim() ? "READY" : "BLOCKED" };
    }

    analyze(statement: FinancialStatementInput): FinancialStatementAnalysis {
        this.validate(statement);

        const grossProfit = statement.revenue - statement.costOfGoodsSold;
        const grossMargin = this.ratio(grossProfit, statement.revenue);
        const operatingProfit = grossProfit - statement.operatingExpenses;
        const operatingMargin = this.ratio(operatingProfit, statement.revenue);
        const currentRatio = this.ratio(statement.currentAssets, statement.currentLiabilities);
        const debtToEquity = this.ratio(statement.totalLiabilities, statement.equity);
        const returnOnAssets = this.ratio(operatingProfit, statement.totalAssets);

        const warnings: string[] = [];
        const explanations: string[] = [];

        if (grossMargin < 0.2) {
            warnings.push("LOW_GROSS_MARGIN");
            explanations.push("Gross margin is below 20%, indicating limited room after direct production or acquisition costs.");
        }
        if (operatingMargin < 0) {
            warnings.push("OPERATING_LOSS");
            explanations.push("Operating profit is negative after operating expenses.");
        }
        if (currentRatio < 1) {
            warnings.push("LIQUIDITY_PRESSURE");
            explanations.push("Current assets are below current liabilities, indicating near-term liquidity pressure.");
        }
        if (debtToEquity > 2) {
            warnings.push("HIGH_LEVERAGE");
            explanations.push("Liabilities exceed two times equity, indicating elevated financial leverage.");
        }
        if (statement.cash !== undefined && statement.cash <= statement.currentLiabilities * 0.25) {
            warnings.push("LOW_CASH_COVERAGE");
            explanations.push("Cash covers 25% or less of current liabilities.");
        }
        if (warnings.length === 0) {
            explanations.push("The supplied statement shows no threshold breach in the configured liquidity, margin or leverage checks.");
        }

        return {
            grossProfit,
            grossMargin,
            operatingProfit,
            operatingMargin,
            currentRatio,
            debtToEquity,
            returnOnAssets,
            warnings,
            explanations
        };
    }

    private ratio(numerator: number, denominator: number): number {
        return denominator === 0 ? 0 : numerator / denominator;
    }

    private validate(statement: FinancialStatementInput): void {
        const fields: Array<keyof FinancialStatementInput> = [
            "revenue",
            "costOfGoodsSold",
            "operatingExpenses",
            "currentAssets",
            "currentLiabilities",
            "totalAssets",
            "totalLiabilities",
            "equity"
        ];
        for (const field of fields) {
            const value = statement[field];
            if (typeof value !== "number" || !Number.isFinite(value)) {
                throw new Error(`INVALID_FINANCIAL_STATEMENT_VALUE:${String(field)}`);
            }
        }
        if (statement.revenue < 0 || statement.costOfGoodsSold < 0 || statement.operatingExpenses < 0) {
            throw new Error("INVALID_FINANCIAL_STATEMENT_VALUE:negative_income_statement_value");
        }
    }
}
