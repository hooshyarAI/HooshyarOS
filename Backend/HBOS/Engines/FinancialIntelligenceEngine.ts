import { Engine } from "../Core/Engine";

export interface FinancialAnalysisInput {
    revenue: number;
    expenses: number;
    assets: number;
    liabilities: number;
}

export interface FinancialAnalysisResult {
    revenue: number;
    expenses: number;
    profit: number;
    profitMargin: number;
    debtRatio: number;
    status: "READY" | "BLOCKED";
}

export class FinancialIntelligenceEngine implements Engine {
    name = "FinancialIntelligenceEngine";

    initialize(): { name: string; status: "READY"; health: "HEALTHY" } {
        return {
            name: this.name,
            status: "READY",
            health: "HEALTHY"
        };
    }

    health(): boolean {
        return true;
    }

    analyze(input: FinancialAnalysisInput): FinancialAnalysisResult {
        if (!input || !Number.isFinite(input.revenue) || !Number.isFinite(input.expenses) || !Number.isFinite(input.assets) || !Number.isFinite(input.liabilities) || input.assets < 0 || input.liabilities < 0) {
            return {
                revenue: 0,
                expenses: 0,
                profit: 0,
                profitMargin: 0,
                debtRatio: 0,
                status: "BLOCKED"
            };
        }

        const profit = input.revenue - input.expenses;
        const profitMargin = input.revenue === 0 ? 0 : profit / input.revenue;
        const debtRatio = input.assets === 0 ? 0 : input.liabilities / input.assets;
        return {
            revenue: input.revenue,
            expenses: input.expenses,
            profit,
            profitMargin,
            debtRatio,
            status: "READY"
        };
    }
}
