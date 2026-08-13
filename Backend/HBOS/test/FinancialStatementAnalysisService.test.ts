import { FinancialStatementAnalysisService } from "../Product/FinancialStatementAnalysisService";

describe("FinancialStatementAnalysisService", () => {
    it("exposes the canonical product boundary", () => {
        const service = new FinancialStatementAnalysisService();
        expect(service.capabilityId).toBe("product.financial-statement-analysis");
        expect(service.targetEngine).toBe("Financial Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("analyzes profitability, liquidity and leverage with explainable evidence", () => {
        const analysis = new FinancialStatementAnalysisService().analyze({
            revenue: 1_000_000,
            costOfGoodsSold: 600_000,
            operatingExpenses: 200_000,
            currentAssets: 300_000,
            currentLiabilities: 200_000,
            totalAssets: 800_000,
            totalLiabilities: 500_000,
            equity: 300_000,
            cash: 50_000
        });

        expect(analysis.grossProfit).toBe(400_000);
        expect(analysis.grossMargin).toBeCloseTo(0.4);
        expect(analysis.operatingProfit).toBe(200_000);
        expect(analysis.operatingMargin).toBeCloseTo(0.2);
        expect(analysis.currentRatio).toBeCloseTo(1.5);
        expect(analysis.debtToEquity).toBeCloseTo(5 / 3);
        expect(analysis.returnOnAssets).toBeCloseTo(0.25);
        expect(analysis.warnings).toEqual(["LOW_CASH_COVERAGE"]);
        expect(analysis.explanations.join(" ")).toMatch(/cash/i);
    });

    it("raises a validation error for invalid financial inputs", () => {
        expect(() => new FinancialStatementAnalysisService().analyze({
            revenue: Number.NaN,
            costOfGoodsSold: 10,
            operatingExpenses: 5,
            currentAssets: 10,
            currentLiabilities: 5,
            totalAssets: 20,
            totalLiabilities: 5,
            equity: 15
        })).toThrow("INVALID_FINANCIAL_STATEMENT_VALUE:revenue");
    });

    it("keeps its deterministic minimal execution contract", () => {
        expect(new FinancialStatementAnalysisService().execute("continue").status).toBe("READY");
        expect(new FinancialStatementAnalysisService().execute(" ").status).toBe("BLOCKED");
    });
});
