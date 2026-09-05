import { AuditAnalyticsService } from "../Product/AuditAnalyticsService";
import { AuditContext } from "../Product/AuditAnalyticsService";

const validCtx: AuditContext = {
    revenue: 1000,
    expenses: 700,
    assets: 2000,
    liabilities: 500,
    equity: 1500,
    cash: 200,
    receivables: 300,
    inventory: 400,
    payables: 100
};

describe("AuditAnalyticsService (09-2.7)", () => {
    const service = new AuditAnalyticsService();

    test("healthy context -> all rules PASS", () => {
        const r = service.run("tenant-1", validCtx);
        expect(r.status).toBe("READY");
        expect(r.tenantId).toBe("tenant-1");
        for (const f of r.findings) {
            expect(f.status).toBe("PASS");
        }
        expect(r.summary.FAIL).toBe(0);
    });

    test("high D/E triggers FAIL with ALERT severity", () => {
        const ctx: AuditContext = { ...validCtx, liabilities: 5000, equity: 100 };
        const r = service.run("tenant-1", ctx);
        const f = r.findings.find(x => x.ruleId === "audit.debt-to-equity-high")!;
        expect(f.status).toBe("FAIL");
        expect(f.severity).toBe("ALERT");
    });

    test("high debt/assets triggers WARN FAIL", () => {
        const ctx: AuditContext = { ...validCtx, liabilities: 1800, assets: 2000 };
        const r = service.run("tenant-1", ctx);
        const f = r.findings.find(x => x.ruleId === "audit.debt-to-assets-high")!;
        expect(f.status).toBe("FAIL");
    });

    test("current ratio < 1 triggers FAIL", () => {
        const ctx: AuditContext = { ...validCtx, cash: 10, receivables: 10, inventory: 10, payables: 100 };
        const r = service.run("tenant-1", ctx);
        const f = r.findings.find(x => x.ruleId === "audit.current-assets-vs-liabilities")!;
        expect(f.status).toBe("FAIL");
    });

    test("expense ratio > 0.95 triggers FAIL", () => {
        const ctx: AuditContext = { ...validCtx, expenses: 980, revenue: 1000 };
        const r = service.run("tenant-1", ctx);
        const f = r.findings.find(x => x.ruleId === "audit.expense-ratio-high")!;
        expect(f.status).toBe("FAIL");
    });

    test("negative profit margin triggers ALERT FAIL", () => {
        const ctx: AuditContext = { ...validCtx, revenue: 1000, expenses: 1200 };
        const r = service.run("tenant-1", ctx);
        const f = r.findings.find(x => x.ruleId === "audit.profit-margin-negative")!;
        expect(f.status).toBe("FAIL");
        expect(f.severity).toBe("ALERT");
    });

    test("zero equity -> debt/equity rule marked N/A", () => {
        const ctx: AuditContext = { ...validCtx, equity: 0, liabilities: 1000 };
        const r = service.run("tenant-1", ctx);
        const f = r.findings.find(x => x.ruleId === "audit.debt-to-equity-high")!;
        expect(f.status).toBe("N/A");
    });

    test("blocks missing tenantId", () => {
        expect(service.run("", validCtx).status).toBe("BLOCKED");
    });

    test("blocks invalid context", () => {
        expect(service.run("tenant-1", null as any).status).toBe("BLOCKED");
        const bad = { ...validCtx, revenue: Number.NaN };
        expect(service.run("tenant-1", bad as any).status).toBe("BLOCKED");
    });

    test("no NaN/Infinity leaks in healthy output", () => {
        const r = service.run("tenant-1", validCtx);
        expect(r.status).toBe("READY");
        for (const f of r.findings) {
            expect(Number.isFinite(f.observed) || f.status === "N/A").toBe(true);
        }
    });
});
