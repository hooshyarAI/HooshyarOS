import { RatioAnalysisService } from "../Product/RatioAnalysisService";

describe("RatioAnalysisService", () => {
    const service = new RatioAnalysisService();

    const statement = {
        revenue: 1000,
        cogs: 400,
        grossProfit: 600,
        operatingExpenses: 200,
        operatingIncome: 400,
        interest: 50,
        preTaxIncome: 350,
        taxes: 100,
        netIncome: 250,
        cash: 100,
        receivables: 150,
        inventory: 100,
        currentAssets: 350,
        ppe: 500,
        totalAssets: 1000,
        payables: 80,
        shortTermDebt: 50,
        currentLiabilities: 130,
        longTermDebt: 270,
        totalLiabilities: 400,
        equity: 600,
    };

    test("vertical analysis on revenue base", () => {
        const result = service.vertical(statement, "revenue");
        expect(result.status).toBe("READY");
        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.base).toBe("revenue");
    });

    test("vertical analysis on assets base", () => {
        const result = service.vertical(statement, "totalAssets");
        expect(result.status).toBe("READY");
        expect(result.base).toBe("totalAssets");
    });

    test("vertical blocks invalid statement", () => {
        expect(service.vertical({ ...statement, revenue: -1 }).status).toBe("BLOCKED");
    });

    test("horizontal analysis computes changes", () => {
        const current: Parameters<typeof service.horizontal>[0] = { ...statement, revenue: 1000, netIncome: 200, totalAssets: 1500 };
        const prior: Parameters<typeof service.horizontal>[1] = { ...statement, revenue: 800, netIncome: 150, totalAssets: 1200 };
        const result = service.horizontal(current, prior);
        expect(result.status).toBe("READY");
        expect(result.entries.length).toBe(12);
    });

    test("profitability computes ratios", () => {
        const result = service.profitability(statement);
        expect(result.status).toBe("READY");
        expect(result.grossMargin).toBeCloseTo(0.6, 5);
        expect(result.roe).toBeCloseTo(0.4167, 3);
    });

    test("leverage computes ratios", () => {
        const result = service.leverage(statement);
        expect(result.status).toBe("READY");
        expect(result.debtToEquity).toBeCloseTo(0.6667, 3);
    });
});
