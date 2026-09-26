import { RatioAnalysisService } from "../Product/RatioAnalysisService";
import { RatioStatement } from "../Product/RatioAnalysisService";

const validStmt: RatioStatement = {
    revenue: 1000, cogs: 600, grossProfit: 400,
    operatingExpenses: 200, operatingIncome: 200,
    interest: 50, preTaxIncome: 150, taxes: 50, netIncome: 100,
    cash: 80, receivables: 100, inventory: 120, currentAssets: 300, ppe: 700, totalAssets: 1000,
    payables: 50, shortTermDebt: 50, currentLiabilities: 100, longTermDebt: 300, totalLiabilities: 400, equity: 600
};

describe("RatioAnalysisService (09-1.13)", () => {
    const service = new RatioAnalysisService();

    test("vertical analysis on revenue base", () => {
        const r = service.vertical(validStmt, "revenue");
        expect(r.status).toBe("READY");
        const rev = r.rows.find(x => x.line === "revenue")!;
        expect(rev.pct).toBe(1);
        const cogs = r.rows.find(x => x.line === "cogs")!;
        expect(cogs.pct).toBe(0.6);
        const net = r.rows.find(x => x.line === "netIncome")!;
        expect(net.pct).toBe(0.10);
    });

    test("vertical analysis on totalAssets base", () => {
        const r = service.vertical(validStmt, "totalAssets");
        expect(r.status).toBe("READY");
        const ta = r.rows.find(x => x.line === "totalAssets")!;
        expect(ta.pct).toBe(1);
        const eq = r.rows.find(x => x.line === "equity")!;
        expect(eq.pct).toBe(0.6);
    });

    test("vertical blocks zero base", () => {
        const stmt = { ...validStmt, revenue: 0 };
        expect(service.vertical(stmt, "revenue").status).toBe("BLOCKED");
    });

    test("horizontal analysis", () => {
        const prior: RatioStatement = { ...validStmt, revenue: 800, netIncome: 60 };
        const r = service.horizontal(validStmt, prior);
        expect(r.status).toBe("READY");
        const rev = r.entries.find(e => e.line === "revenue")!;
        expect(rev.absoluteChange).toBe(200);
        expect(rev.pctChange).toBeCloseTo(0.25, 5);
    });

    test("horizontal blocks NaN", () => {
        const bad: any = { ...validStmt };
        bad.netIncome = Number.NaN;
        expect(service.horizontal(validStmt, bad).status).toBe("BLOCKED");
    });

    test("profitability ratios", () => {
        const r = service.profitability(validStmt);
        expect(r.status).toBe("READY");
        expect(r.grossMargin).toBeCloseTo(0.4, 5);
        expect(r.operatingMargin).toBeCloseTo(0.2, 5);
        expect(r.netMargin).toBeCloseTo(0.10, 5);
        expect(r.roa).toBeCloseTo(0.10, 5);
        expect(r.roe).toBeCloseTo(0.1667, 3);
    });

    test("leverage ratios", () => {
        const r = service.leverage(validStmt);
        expect(r.status).toBe("READY");
        expect(r.debtToAssets).toBe(0.4);
        expect(r.equityRatio).toBe(0.6);
        expect(r.debtToEquity).toBeCloseTo(0.6667, 3);
    });

    test("no NaN/Infinity leaks", () => {
        const stmt: RatioStatement = { ...validStmt, netIncome: 0 };
        const r = service.profitability(stmt);
        expect(r.status).toBe("READY");
        expect(Number.isFinite(r.roe)).toBe(true);
    });
});
