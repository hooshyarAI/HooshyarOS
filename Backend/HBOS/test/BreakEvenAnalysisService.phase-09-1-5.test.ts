import { BreakEvenAnalysisService } from "../Product/BreakEvenAnalysisService";

describe("BreakEvenAnalysisService (09-1.5)", () => {
    const service = new BreakEvenAnalysisService();

    test("break-even units known: FC=1000, VCU=5, PPU=10 -> 200 units", () => {
        const r = service.analyze({ fixedCosts: 1000, variableCostPerUnit: 5, pricePerUnit: 10 });
        expect(r.status).toBe("READY");
        expect(r.contributionMargin).toBe(5);
        expect(r.contributionMarginRatio).toBe(0.5);
        expect(r.breakEvenUnits).toBe(200);
        expect(r.breakEvenRevenue).toBe(2000);
    });

    test("break-even when price <= variable cost -> BLOCKED", () => {
        const r = service.analyze({ fixedCosts: 1000, variableCostPerUnit: 10, pricePerUnit: 5 });
        expect(r.status).toBe("BLOCKED");
        expect(r.breakEvenUnits).toBe(Number.POSITIVE_INFINITY);
    });

    test("break-even blocks negative inputs", () => {
        expect(service.analyze({ fixedCosts: -1, variableCostPerUnit: 5, pricePerUnit: 10 }).status).toBe("BLOCKED");
        expect(service.analyze({ fixedCosts: 1000, variableCostPerUnit: -1, pricePerUnit: 10 }).status).toBe("BLOCKED");
        expect(service.analyze({ fixedCosts: 1000, variableCostPerUnit: 5, pricePerUnit: -1 }).status).toBe("BLOCKED");
    });

    test("marginOfSafety: revenue 3000, BE 2000 -> amount 1000, ratio 0.333", () => {
        const r = service.marginOfSafety(2000, 3000);
        expect(r.status).toBe("READY");
        expect(r.amount).toBe(1000);
        expect(r.ratio).toBeCloseTo(0.3333, 3);
    });

    test("marginOfSafety blocks zero revenue", () => {
        expect(service.marginOfSafety(2000, 0).status).toBe("BLOCKED");
    });

    test("margins computes gross, operating, preTax, net", () => {
        const r = service.margins({ revenue: 1000, cogs: 600, operatingExpenses: 200, interest: 50, taxes: 50 });
        expect(r.status).toBe("READY");
        expect(r.gross).toBeCloseTo(0.4, 5);
        // operating profit = 1000 - 600 - 200 = 200
        // operating margin = 0.2
        expect(r.operating).toBeCloseTo(0.2, 5);
        // pre-tax = (200 - 50) / 1000 = 0.15
        expect(r.preTax).toBeCloseTo(0.15, 5);
        // net = (200 - 50 - 50) / 1000 = 0.10
        expect(r.net).toBeCloseTo(0.10, 5);
    });

    test("margins with zero revenue -> 0", () => {
        const r = service.margins({ revenue: 0, cogs: 0, operatingExpenses: 0, interest: 0, taxes: 0 });
        expect(r.status).toBe("READY");
        expect(r.gross).toBe(0);
    });

    test("margins blocks negative inputs", () => {
        expect(service.margins({ revenue: -1, cogs: 0, operatingExpenses: 0, interest: 0, taxes: 0 }).status).toBe("BLOCKED");
    });

    test("no NaN/Infinity leaks", () => {
        const r = service.analyze({ fixedCosts: 0, variableCostPerUnit: 0, pricePerUnit: 10 });
        expect(r.status).toBe("READY");
        expect(r.breakEvenUnits).toBe(0);
        expect(Number.isFinite(r.breakEvenRevenue)).toBe(true);
    });
});
