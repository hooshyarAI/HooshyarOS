/**
 * Phase 09-2.7: Audit Analytics (product service).
 *
 * Rule-based audit checks that operate on tenant-scoped financial data.
 * The service is deterministic; AI / reasoning remains interpretation only.
 *
 * Each rule has:
 *   - id: stable identifier
 *   - severity: INFO | WARN | ALERT
 *   - description: human-readable
 *   - check(ctx): returns the actual value of the observed metric, or NaN if N/A
 */

export type AuditSeverity = "INFO" | "WARN" | "ALERT";
export type AuditStatus = "PASS" | "FAIL" | "N/A";

export interface AuditRule {
    id: string;
    severity: AuditSeverity;
    description: string;
    check: (ctx: AuditContext) => number;
}

export interface AuditFinding {
    ruleId: string;
    severity: AuditSeverity;
    description: string;
    observed: number;
    status: AuditStatus;
}

export interface AuditContext {
    revenue: number;
    expenses: number;
    assets: number;
    liabilities: number;
    equity: number;
    cash: number;
    receivables: number;
    inventory: number;
    payables: number;
    /** Optional names of recent transaction counterparties. */
    counterpartyCounts?: Record<string, number>;
}

export interface AuditAnalyticsResult {
    tenantId: string;
    findings: AuditFinding[];
    summary: { PASS: number; FAIL: number; "N/A": number };
    status: "READY" | "BLOCKED";
}

export class AuditAnalyticsService {
    static readonly DEFAULT_RULES: AuditRule[] = [
        {
            id: "audit.debt-to-equity-high",
            severity: "ALERT",
            description: "Debt/Equity ratio exceeds 3.0 (highly leveraged)",
            check: (ctx) => ctx.equity === 0 ? Number.NaN : ctx.liabilities / ctx.equity
        },
        {
            id: "audit.debt-to-assets-high",
            severity: "WARN",
            description: "Debt/Assets ratio exceeds 0.8",
            check: (ctx) => ctx.assets === 0 ? Number.NaN : ctx.liabilities / ctx.assets
        },
        {
            id: "audit.current-assets-vs-liabilities",
            severity: "WARN",
            description: "Current assets (cash + receivables + inventory) less than current payables (proxy for current ratio < 1)",
            check: (ctx) => {
                const ca = ctx.cash + ctx.receivables + ctx.inventory;
                return ctx.payables === 0 ? Number.NaN : ca / ctx.payables;
            }
        },
        {
            id: "audit.expense-ratio-high",
            severity: "WARN",
            description: "Expenses/Revenue ratio exceeds 0.95 (thin margin)",
            check: (ctx) => ctx.revenue === 0 ? Number.NaN : ctx.expenses / ctx.revenue
        },
        {
            id: "audit.profit-margin-negative",
            severity: "ALERT",
            description: "Net profit margin is negative",
            check: (ctx) => ctx.revenue === 0 ? Number.NaN : (ctx.revenue - ctx.expenses) / ctx.revenue
        }
    ];

    private validateContext(ctx: AuditContext | undefined | null): boolean {
        if (!ctx) return false;
        const required: (keyof AuditContext)[] = ["revenue", "expenses", "assets", "liabilities", "equity", "cash", "receivables", "inventory", "payables"];
        for (const f of required) {
            if (!Number.isFinite((ctx as any)[f])) return false;
            if ((ctx as any)[f] < 0) return false;
        }
        return true;
    }

    run(tenantId: string, ctx: AuditContext, rules: readonly AuditRule[] = AuditAnalyticsService.DEFAULT_RULES): AuditAnalyticsResult {
        if (typeof tenantId !== "string" || !tenantId.trim() || !this.validateContext(ctx) || !Array.isArray(rules)) {
            return { tenantId: tenantId ?? "", findings: [], summary: { PASS: 0, FAIL: 0, "N/A": 0 }, status: "BLOCKED" };
        }
        const findings: AuditFinding[] = [];
        for (const rule of rules) {
            if (!rule || typeof rule.id !== "string" || typeof rule.check !== "function") {
                continue;
            }
            let observed = Number.NaN;
            try {
                observed = rule.check(ctx);
            } catch {
                observed = Number.NaN;
            }
            if (!Number.isFinite(observed)) {
                findings.push({ ruleId: rule.id, severity: rule.severity, description: rule.description, observed, status: "N/A" });
                continue;
            }
            // Threshold logic per severity / id
            let status: AuditStatus = "PASS";
            if (rule.id === "audit.debt-to-equity-high") {
                status = observed > 3.0 ? "FAIL" : "PASS";
            } else if (rule.id === "audit.debt-to-assets-high") {
                status = observed > 0.8 ? "FAIL" : "PASS";
            } else if (rule.id === "audit.current-assets-vs-liabilities") {
                status = observed < 1.0 ? "FAIL" : "PASS";
            } else if (rule.id === "audit.expense-ratio-high") {
                status = observed > 0.95 ? "FAIL" : "PASS";
            } else if (rule.id === "audit.profit-margin-negative") {
                status = observed < 0 ? "FAIL" : "PASS";
            }
            findings.push({ ruleId: rule.id, severity: rule.severity, description: rule.description, observed, status });
        }
        const summary = findings.reduce((acc, f) => {
            acc[f.status] += 1;
            return acc;
        }, { PASS: 0, FAIL: 0, "N/A": 0 } as { PASS: number; FAIL: number; "N/A": number });
        return { tenantId, findings, summary, status: "READY" };
    }
}
