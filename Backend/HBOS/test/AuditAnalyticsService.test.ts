import { AuditAnalyticsService } from "../Product/AuditAnalyticsService";

describe("AuditAnalyticsService", () => {
    const service = new AuditAnalyticsService();

    test("run detects high debt-to-equity", () => {
        const result = service.run("tenant-a", {
            revenue: 1000, expenses: 800, assets: 500, liabilities: 600, equity: 100, cash: 50, receivables: 100, inventory: 50, payables: 80
        });
        expect(result.status).toBe("READY");
        expect(result.findings.some(f => f.ruleId === "audit.debt-to-equity-high" && f.status === "FAIL")).toBe(true);
    });

    test("run passes clean context", () => {
        const result = service.run("tenant-a", {
            revenue: 1000, expenses: 600, assets: 800, liabilities: 200, equity: 600, cash: 200, receivables: 200, inventory: 100, payables: 100
        });
        expect(result.status).toBe("READY");
        expect(result.findings.every(f => f.status === "PASS" || f.status === "N/A")).toBe(true);
    });

    test("run blocks invalid tenant", () => {
        const result = service.run("", {
            revenue: 1000, expenses: 600, assets: 800, liabilities: 200, equity: 600, cash: 200, receivables: 200, inventory: 100, payables: 100
        });
        expect(result.status).toBe("BLOCKED");
    });
});
