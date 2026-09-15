import { BreakEvenAnalysisService } from "../Product/BreakEvenAnalysisService";

describe("BreakEvenAnalysisService", () => {
    const service = new BreakEvenAnalysisService();

    test("analyze happy path", () => {
        const result = service.analyze({ fixedCosts: 1000, variableCostPerUnit: 5, pricePerUnit: 20, unitsSold: 150 });
        expect(result.status).toBe("READY");
        expect(result.breakEvenUnits).toBeCloseTo(66.67, 2);
        expect(result.contributionMargin).toBe(15);
        expect(result.contributionMarginRatio).toBeCloseTo(0.75, 2);
        expect(result.marginOfSafety).toBeCloseTo(83.33, 2);
        expect(result.marginOfSafetyRatio).toBeCloseTo(0.56, 2);
    });

    test("analyze blocks invalid input", () => {
        expect(service.analyze({ fixedCosts: NaN, variableCostPerUnit: 5, pricePerUnit: 20, unitsSold: 10 }).status).toBe("BLOCKED");
        expect(service.analyze({ fixedCosts: 100, variableCostPerUnit: 5, pricePerUnit: 0, unitsSold: 10 }).status).toBe("BLOCKED");
        expect(service.analyze({ fixedCosts: 100, variableCostPerUnit: 20, pricePerUnit: 20, unitsSold: 10 }).status).toBe("BLOCKED");
    });

    test("marginOfSafety computes correctly", () => {
        const result = service.marginOfSafety(150, 66.67);
        expect(result.marginOfSafety).toBeCloseTo(83.33, 2);
        expect(result.marginOfSafetyRatio).toBeCloseTo(0.56, 2);
    });

    test("margins computes ratios", () => {
        const result = service.margins({ revenue: 1000, cogs: 400, operatingExpenses: 200, netIncome: 300 });
        expect(result.grossMargin).toBe(600);
        expect(result.grossMarginRatio).toBeCloseTo(0.6, 2);
        expect(result.operatingMarginRatio).toBeCloseTo(0.4, 2);
        expect(result.netMarginRatio).toBeCloseTo(0.3, 2);
    });
});
