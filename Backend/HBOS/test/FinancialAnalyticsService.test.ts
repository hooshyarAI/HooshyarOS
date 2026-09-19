import { FinancialAnalyticsService } from "../Product/FinancialAnalyticsService";
import type { RatioStatement } from "../Product/RatioAnalysisService";

const STATEMENT: RatioStatement = {
    revenue: 1000,
    cogs: 600,
    grossProfit: 400,
    operatingExpenses: 200,
    operatingIncome: 200,
    interest: 20,
    preTaxIncome: 180,
    taxes: 30,
    netIncome: 150,
    cash: 100,
    receivables: 200,
    inventory: 150,
    currentAssets: 450,
    ppe: 550,
    totalAssets: 1000,
    payables: 120,
    shortTermDebt: 80,
    currentLiabilities: 200,
    longTermDebt: 200,
    totalLiabilities: 400,
    equity: 600,
};

describe("product.financial-analytics — composition owner", () => {
    const service = new FinancialAnalyticsService();

    test("requires the tenant boundary", () => {
        expect(() => service.execute({ tenantId: "   " })).toThrow("financial-analytics-tenant-required");
    });

    test("fails closed to BLOCKED when no analyzable input is supplied", () => {
        const result = service.execute({ tenantId: "tenant-a" });
        expect(result.status).toBe("BLOCKED");
        expect(result.ratios).toBeNull();
        expect(result.breakEven).toBeNull();
        expect(result.forecast).toBeNull();
        expect(result.anomalies).toBeNull();
    });

    test("composes ratio analysis with profitability and leverage", () => {
        const result = service.execute({ tenantId: "tenant-a", statement: STATEMENT });
        expect(result.status).toBe("READY");
        expect(result.capabilityId).toBe("product.financial-analytics");
        expect(result.targetEngine).toBe("Financial Intelligence Engine");
        expect(result.ratios?.vertical?.rows.length).toBeGreaterThan(0);
        expect(result.ratios?.profitability?.netMargin).toBeCloseTo(0.15, 6);
        expect(result.ratios?.leverage?.debtToEquity).toBeCloseTo(400 / 600, 6);
        expect(result.ratios?.horizontal).toBeNull();
    });

    test("composes break-even analysis", () => {
        const result = service.execute({
            tenantId: "tenant-a",
            breakEven: { fixedCosts: 1000, variableCostPerUnit: 5, pricePerUnit: 10, unitsSold: 300 },
        });
        expect(result.status).toBe("READY");
        expect(result.breakEven?.breakEvenUnits).toBe(200);
        expect(result.breakEven?.breakEvenRevenue).toBe(2000);
        expect(result.breakEven?.marginOfSafety).toBe(100);
        expect(result.ratios).toBeNull();
    });

    test("composes forecasting and anomaly detection over a series", () => {
        const result = service.execute({ tenantId: "tenant-a", series: [100, 110, 90, 130, 120] });
        expect(result.status).toBe("READY");
        expect(result.forecast?.naive.forecast).toBe(120);
        expect(result.forecast?.movingAverage.forecast).toBeCloseTo((90 + 130 + 120) / 3, 6);
        expect(result.forecast?.linearTrend.status).toBe("READY");
        expect(result.anomalies?.zscore.points).toHaveLength(5);
        expect(result.anomalies?.iqr.points).toHaveLength(5);
        expect(result.anomalies?.modifiedZ.points).toHaveLength(5);
        expect(result.breakEven).toBeNull();
    });

    test("blocks an invalid series instead of fabricating values", () => {
        const result = service.execute({ tenantId: "tenant-a", series: [100, Number.NaN, 120] });
        expect(result.forecast).toBeNull();
        expect(result.anomalies).toBeNull();
        expect(result.status).toBe("BLOCKED");
    });

    test("carries owner BLOCKED status when a statement is insufficient", () => {
        const result = service.execute({ tenantId: "tenant-a", statement: { ...STATEMENT, revenue: -1 } });
        expect(result.status).toBe("BLOCKED");
        expect(result.ratios?.profitability?.status).toBe("BLOCKED");
    });
});
