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

    test("a genuinely corrupt magnitude still fails the whole method closed", () => {
        expect(service.profitability({ revenue: 1000, netIncome: Number.NaN }).status).toBe("BLOCKED");
        // A negative revenue/asset/liability magnitude is corruption, not a loss.
        expect(service.vertical({ revenue: -1 }).status).toBe("BLOCKED");
        expect(service.leverage({ totalAssets: -1, totalLiabilities: 100, equity: 50 }).status).toBe("BLOCKED");
    });

    test("signed losses produce negative margins and returns", () => {
        const result = service.profitability({ revenue: 1000, grossProfit: -200, operatingIncome: -150, netIncome: -100, totalAssets: 2000, equity: 500 });
        expect(result.status).toBe("READY");
        expect(result.grossMargin).toBeCloseTo(-0.2, 6);
        expect(result.operatingMargin).toBeCloseTo(-0.15, 6);
        expect(result.netMargin).toBeCloseTo(-0.1, 6);
        expect(result.roa).toBeCloseTo(-0.05, 6);
        expect(result.roe).toBeCloseTo(-0.2, 6);
    });

    test("negative equity makes ROE and debt/equity not applicable, not fabricated", () => {
        const result = service.profitability({ revenue: 1000, netIncome: -100, totalAssets: 500, equity: -200 });
        expect(result.roe).toBeNull();
        expect(result.notApplicable).toContain("roe:equity-non-positive");
        expect(result.unavailable).not.toContain("roe");

        const leverage = service.leverage({ totalAssets: 500, totalLiabilities: 700, equity: -200 });
        expect(leverage.debtToEquity).toBeNull();
        expect(leverage.notApplicable).toContain("debtToEquity:equity-non-positive");
        expect(leverage.debtToAssets).toBeCloseTo(1.4, 6);
        expect(leverage.equityRatio).toBeCloseTo(-0.4, 6);
    });

    test("horizontal change is null for a zero prior base and preserves the absolute change", () => {
        const result = service.horizontal({ revenue: 1000, netIncome: 50 }, { revenue: 0, netIncome: 0 });
        const revenue = result.entries.find((entry) => entry.line === "revenue");
        expect(revenue?.absoluteChange).toBe(1000);
        expect(revenue?.pctChange).toBeNull();
        expect(revenue?.pctChangeUnavailableReason).toBe("prior-value-zero");
    });

    test("horizontal change exposes a sign reversal instead of a misleading percentage", () => {
        const result = service.horizontal({ revenue: 1000, netIncome: 300 }, { revenue: 1000, netIncome: -200 });
        const netIncome = result.entries.find((entry) => entry.line === "netIncome");
        expect(netIncome?.signReversal).toBe(true);
        expect(netIncome?.pctChange).toBeNull();
        expect(netIncome?.pctChangeUnavailableReason).toBe("sign-reversal");
        expect(netIncome?.absoluteChange).toBe(500);
    });

    test("a negative prior base without reversal uses the magnitude so direction stays truthful", () => {
        const result = service.horizontal({ revenue: 100, netIncome: -100 }, { revenue: 100, netIncome: -200 });
        const netIncome = result.entries.find((entry) => entry.line === "netIncome");
        expect(netIncome?.pctChange).toBeCloseTo(0.5, 6);
        expect(netIncome?.signReversal).toBe(false);
    });
});
