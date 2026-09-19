import { BreakEvenAnalysisService } from "../Product/BreakEvenAnalysisService";

describe("BreakEvenAnalysisService (phase-09 contract, reconciled)", () => {
    const service = new BreakEvenAnalysisService();

    test("break-even units known: FC=1000, VCU=5, PPU=10 -> 200 units", () => {
        const r = service.analyze({ fixedCosts: 1000, variableCostPerUnit: 5, pricePerUnit: 10, unitsSold: 300 });
        expect(r.status).toBe("READY");
        expect(r.contributionMargin).toBe(5);
        expect(r.contributionMarginRatio).toBe(0.5);
        expect(r.breakEvenUnits).toBe(200);
        expect(r.breakEvenRevenue).toBe(2000);
        expect(r.marginOfSafety).toBe(100);
        expect(r.marginOfSafetyRatio).toBe(0.33);
    });

    test("break-even fails closed when price <= variable cost", () => {
        const r = service.analyze({ fixedCosts: 1000, variableCostPerUnit: 10, pricePerUnit: 10, unitsSold: 100 });
        expect(r.status).toBe("BLOCKED");
        expect(r.breakEvenUnits).toBe(0);
        expect(r.breakEvenRevenue).toBe(0);
    });

    test("break-even fails closed on negative or non-finite inputs", () => {
        expect(service.analyze({ fixedCosts: -1, variableCostPerUnit: 5, pricePerUnit: 10, unitsSold: 1 }).status).toBe("BLOCKED");
        expect(service.analyze({ fixedCosts: 1000, variableCostPerUnit: -1, pricePerUnit: 10, unitsSold: 1 }).status).toBe("BLOCKED");
        expect(service.analyze({ fixedCosts: 1000, variableCostPerUnit: 5, pricePerUnit: -1, unitsSold: 1 }).status).toBe("BLOCKED");
        expect(service.analyze({ fixedCosts: NaN, variableCostPerUnit: 5, pricePerUnit: 10, unitsSold: 1 }).status).toBe("BLOCKED");
    });

    test("zero fixed costs produce zero break-even without Infinity leaks", () => {
        const r = service.analyze({ fixedCosts: 0, variableCostPerUnit: 0, pricePerUnit: 10, unitsSold: 0 });
        expect(r.status).toBe("READY");
        expect(r.breakEvenUnits).toBe(0);
        expect(r.breakEvenRevenue).toBe(0);
        expect(Number.isFinite(r.marginOfSafetyRatio)).toBe(true);
    });

    test("marginOfSafety: actual 3000, break-even 2000 -> amount 1000, ratio ~0.333", () => {
        const r = service.marginOfSafety(3000, 2000);
        expect(r.marginOfSafety).toBe(1000);
        expect(r.marginOfSafetyRatio).toBeCloseTo(0.33, 2);
    });

    test("marginOfSafety is fail-safe for boundary and invalid input", () => {
        expect(service.marginOfSafety(2000, 0)).toEqual({ marginOfSafety: 2000, marginOfSafetyRatio: 1 });
        expect(service.marginOfSafety(0, 0)).toEqual({ marginOfSafety: 0, marginOfSafetyRatio: 0 });
        expect(service.marginOfSafety(NaN, 100)).toEqual({ marginOfSafety: 0, marginOfSafetyRatio: 0 });
        expect(service.marginOfSafety(-1, 100)).toEqual({ marginOfSafety: 0, marginOfSafetyRatio: 0 });
    });

    test("margins computes gross, operating and net ratios", () => {
        const r = service.margins({ revenue: 1000, cogs: 400, operatingExpenses: 200, netIncome: 300 });
        expect(r.grossMargin).toBe(600);
        expect(r.grossMarginRatio).toBeCloseTo(0.6, 5);
        expect(r.operatingMargin).toBe(400);
        expect(r.operatingMarginRatio).toBeCloseTo(0.4, 5);
        expect(r.netMargin).toBe(300);
        expect(r.netMarginRatio).toBeCloseTo(0.3, 5);
    });

    test("margins fails closed to zero on zero revenue or non-finite input", () => {
        const zero = service.margins({ revenue: 0, cogs: 0, operatingExpenses: 0, netIncome: 0 });
        expect(zero).toEqual({
            grossMargin: 0, grossMarginRatio: 0,
            operatingMargin: 0, operatingMarginRatio: 0,
            netMargin: 0, netMarginRatio: 0,
        });
        const bad = service.margins({ revenue: NaN, cogs: 0, operatingExpenses: 0, netIncome: 0 });
        expect(bad.grossMargin).toBe(0);
        expect(bad.netMarginRatio).toBe(0);
    });
});
