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

    test("liquidity computes the current ratio and marks quick/cash unavailable without evidence", () => {
        const result = service.liquidity(statement);
        expect(result.status).toBe("READY");
        expect(result.currentRatio).toBeCloseTo(350 / 130, 6);
        expect(result.quickRatio).toBeCloseTo((350 - 100) / 130, 6);
        expect(result.cashRatio).toBeCloseTo(100 / 130, 6);
        expect(result.unavailable).toEqual([]);
    });

    test("computes the ratios a partial statement actually supports", () => {
        const partial = {
            revenue: 1000,
            grossProfit: 400,
            netIncome: 150,
            currentAssets: 450,
            totalAssets: 1000,
            currentLiabilities: 200,
            totalLiabilities: 400,
            equity: 600,
        };
        const profitability = service.profitability(partial);
        expect(profitability.status).toBe("READY");
        expect(profitability.grossMargin).toBeCloseTo(0.4, 6);
        expect(profitability.netMargin).toBeCloseTo(0.15, 6);
        expect(profitability.roe).toBeCloseTo(0.25, 6);
        expect(profitability.operatingMargin).toBeNull();
        expect(profitability.unavailable).toContain("operatingMargin");

        const leverage = service.leverage(partial);
        expect(leverage.status).toBe("READY");
        expect(leverage.debtToAssets).toBeCloseTo(0.4, 6);
        expect(leverage.equityRatio).toBeCloseTo(0.6, 6);

        const liquidity = service.liquidity(partial);
        expect(liquidity.status).toBe("READY");
        expect(liquidity.currentRatio).toBeCloseTo(2.25, 6);
        expect(liquidity.quickRatio).toBeNull();
        expect(liquidity.cashRatio).toBeNull();
        expect(liquidity.unavailable).toEqual(expect.arrayContaining(["quickRatio", "cashRatio"]));

        const vertical = service.vertical(partial, "revenue");
        expect(vertical.status).toBe("READY");
        expect(vertical.rows.map((row) => row.line)).not.toContain("cogs");
        expect(vertical.rows.map((row) => row.line)).toContain("grossProfit");
        expect(vertical.unavailable).toContain("cogs");
    });

    test("a missing ratio is unavailable, never a fabricated zero", () => {
        const result = service.profitability({ revenue: 1000 });
        expect(result.status).toBe("BLOCKED");
        expect(result.grossMargin).toBeNull();
        expect(result.netMargin).toBeNull();
        expect(result.unavailable).toEqual(
            expect.arrayContaining(["grossMargin", "operatingMargin", "netMargin", "roa", "roe"]),
        );
    });

    test("an explicitly invalid value still fails the whole method closed", () => {
        const result = service.profitability({ revenue: 1000, netIncome: -1 });
        expect(result.status).toBe("BLOCKED");
        expect(result.netMargin).toBeNull();
    });
});
