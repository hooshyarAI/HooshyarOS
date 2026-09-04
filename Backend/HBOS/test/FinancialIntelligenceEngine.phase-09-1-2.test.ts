import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";

describe("FinancialIntelligenceEngine Working Capital & Liquidity (09-1.2)", () => {
    const engine = new FinancialIntelligenceEngine();

    test("workingCapital computes DSO, DIO, DPO and CCC", () => {
        const r = engine.workingCapital({
            revenue: 1000,
            cogs: 600,
            receivables: 100,
            inventory: 150,
            payables: 50
        });
        expect(r.status).toBe("READY");
        expect(r.receivablesDays).toBeCloseTo(36.5, 5);
        expect(r.inventoryDays).toBeCloseTo(91.25, 5);
        expect(r.payablesDays).toBeCloseTo(30.4167, 3);
        expect(r.cashConversionCycle).toBeCloseTo(97.3333, 3);
        expect(r.netWorkingCapital).toBe(200);
    });

    test("workingCapital zero revenue -> 0 DSO", () => {
        const r = engine.workingCapital({ revenue: 0, cogs: 100, receivables: 50, inventory: 50, payables: 25 });
        expect(r.status).toBe("READY");
        expect(r.receivablesDays).toBe(0);
    });

    test("workingCapital blocks negative revenue", () => {
        expect(engine.workingCapital({ revenue: -1, cogs: 100, receivables: 50, inventory: 50, payables: 25 }).status).toBe("BLOCKED");
    });

    test("workingCapital blocks NaN input", () => {
        expect(engine.workingCapital({ revenue: Number.NaN, cogs: 100, receivables: 50, inventory: 50, payables: 25 }).status).toBe("BLOCKED");
    });

    test("liquidityRatios computes current/quick/cash", () => {
        const r = engine.liquidityRatios({ currentAssets: 200, inventory: 50, cash: 30, currentLiabilities: 100 });
        expect(r.status).toBe("READY");
        expect(r.currentRatio).toBe(2);
        expect(r.quickRatio).toBe(1.5);
        expect(r.cashRatio).toBe(0.3);
    });

    test("liquidityRatios blocks zero current liabilities", () => {
        expect(engine.liquidityRatios({ currentAssets: 200, inventory: 50, cash: 30, currentLiabilities: 0 }).status).toBe("BLOCKED");
    });

    test("liquidityRatios blocks negative inputs", () => {
        expect(engine.liquidityRatios({ currentAssets: -1, inventory: 50, cash: 30, currentLiabilities: 100 }).status).toBe("BLOCKED");
        expect(engine.liquidityRatios({ currentAssets: 200, inventory: -1, cash: 30, currentLiabilities: 100 }).status).toBe("BLOCKED");
    });

    test("no NaN/Infinity leaks", () => {
        const r = engine.workingCapital({ revenue: 0, cogs: 0, receivables: 0, inventory: 0, payables: 0 });
        expect(r.status).toBe("READY");
        expect(Number.isFinite(r.cashConversionCycle)).toBe(true);
        expect(Number.isFinite(r.netWorkingCapital)).toBe(true);
    });
});
