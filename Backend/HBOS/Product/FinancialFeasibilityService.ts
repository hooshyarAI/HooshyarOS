import { FinancialIntelligenceEngine, type CashFlowSeries } from "../Engines/FinancialIntelligenceEngine";
import { RiskIntelligenceEngine } from "../Engines/RiskIntelligenceEngine";

export interface FinancialFeasibilityInput {
    readonly tenantId: string;
    readonly projectName: string;
    readonly currency: string;
    readonly initialInvestment: number;
    readonly cashFlows: readonly number[];
    /** Decimal rate, e.g. 0.1 for 10%. */
    readonly discountRate: number;
}
export interface FinancialFeasibilityBlockedResult { readonly status: "BLOCKED"; readonly reason: string; }
export interface FinancialFeasibilityReadyResult {
    readonly status: "READY";
    readonly capabilityId: "product.financial-feasibility";
    readonly targetEngine: "FinancialIntelligenceEngine + RiskIntelligenceEngine";
    readonly tenantId: string;
    readonly projectName: string;
    readonly currency: string;
    readonly initialInvestment: number;
    readonly cashFlows: readonly number[];
    readonly discountRate: number;
    readonly npv: ReturnType<FinancialIntelligenceEngine["npv"]>;
    readonly irr: ReturnType<FinancialIntelligenceEngine["irr"]>;
    readonly payback: ReturnType<FinancialIntelligenceEngine["payback"]>;
    readonly cashFlowScenarios: ReturnType<RiskIntelligenceEngine["scenario"]>;
    readonly indicativeSignal: "NPV_POSITIVE_AT_ASSUMED_RATE" | "NPV_NEGATIVE_AT_ASSUMED_RATE" | "NPV_ZERO_AT_ASSUMED_RATE";
    readonly qualification: "REVIEW_REQUIRED";
    readonly requiresHumanReview: true;
    readonly assumptions: readonly string[];
    readonly limitations: readonly string[];
}
export type FinancialFeasibilityResult = FinancialFeasibilityReadyResult | FinancialFeasibilityBlockedResult;

/** Composition over canonical financial/risk owners; no duplicated financial mathematics. */
export class FinancialFeasibilityService {
    readonly capabilityId = "product.financial-feasibility" as const;
    readonly targetEngine = "FinancialIntelligenceEngine + RiskIntelligenceEngine" as const;
    constructor(
        private readonly financial: FinancialIntelligenceEngine = new FinancialIntelligenceEngine(),
        private readonly risk: RiskIntelligenceEngine = new RiskIntelligenceEngine(),
    ) {}

    execute(input: FinancialFeasibilityInput): FinancialFeasibilityResult {
        const blocked = (reason: string): FinancialFeasibilityBlockedResult => ({ status: "BLOCKED", reason });
        const tenantId = typeof input?.tenantId === "string" ? input.tenantId.trim() : "";
        const projectName = typeof input?.projectName === "string" ? input.projectName.trim() : "";
        const currency = typeof input?.currency === "string" ? input.currency.trim() : "";
        if (!tenantId) return blocked("FEASIBILITY_TENANT_REQUIRED");
        if (!projectName) return blocked("FEASIBILITY_PROJECT_NAME_REQUIRED");
        if (!currency) return blocked("FEASIBILITY_CURRENCY_REQUIRED");
        if (typeof input.initialInvestment !== "number" || !Number.isFinite(input.initialInvestment) || input.initialInvestment <= 0) return blocked("FEASIBILITY_INITIAL_INVESTMENT_INVALID");
        if (typeof input.discountRate !== "number" || !Number.isFinite(input.discountRate) || input.discountRate < 0) return blocked("FEASIBILITY_DISCOUNT_RATE_INVALID");
        if (!Array.isArray(input.cashFlows) || input.cashFlows.length === 0 || input.cashFlows.length > 50 ||
            !input.cashFlows.every((flow) => typeof flow === "number" && Number.isFinite(flow))) return blocked("FEASIBILITY_CASH_FLOWS_INVALID");

        const initial = -input.initialInvestment;
        const flows = [...input.cashFlows];
        const series: CashFlowSeries = { initial, flows, discountRate: input.discountRate };
        const npv = this.financial.npv(series);
        if (npv.status !== "READY" || !Number.isFinite(npv.npv)) return blocked("FEASIBILITY_NPV_UNAVAILABLE");
        const irr = this.financial.irr({ initial, flows });
        const payback = this.financial.payback(series);
        if (payback.status !== "READY") return blocked("FEASIBILITY_PAYBACK_UNAVAILABLE");

        const definitions = [
            { name: "کاهش ۲۰٪ جریان نقدی", multiplier: 0.8 },
            { name: "کاهش ۱۰٪ جریان نقدی", multiplier: 0.9 },
            { name: "جریان نقدی مبنا", multiplier: 1 },
            { name: "افزایش ۱۰٪ جریان نقدی", multiplier: 1.1 },
            { name: "افزایش ۲۰٪ جریان نقدی", multiplier: 1.2 },
        ] as const;
        const cashFlowScenarios = this.risk.scenario({
            base: { cashFlowMultiplier: 1 },
            scenarios: definitions.map((s) => ({ name: s.name, params: { cashFlowMultiplier: s.multiplier } })),
            model: (params) => {
                const candidateFlows = flows.map((flow) => flow * params.cashFlowMultiplier);
                const result = this.financial.npv({ initial, flows: candidateFlows, discountRate: input.discountRate });
                return result.status === "READY" && Number.isFinite(result.npv) ? result.npv : Number.NaN;
            },
        });
        if (cashFlowScenarios.status !== "READY" || cashFlowScenarios.entries.length !== definitions.length) return blocked("FEASIBILITY_SCENARIO_ANALYSIS_UNAVAILABLE");

        return Object.freeze({
            status: "READY", capabilityId: this.capabilityId, targetEngine: this.targetEngine,
            tenantId, projectName, currency, initialInvestment: input.initialInvestment,
            cashFlows: Object.freeze(flows), discountRate: input.discountRate,
            npv: Object.freeze(npv), irr: Object.freeze(irr), payback: Object.freeze(payback),
            cashFlowScenarios: Object.freeze(cashFlowScenarios),
            indicativeSignal: npv.npv > 0 ? "NPV_POSITIVE_AT_ASSUMED_RATE" : npv.npv < 0 ? "NPV_NEGATIVE_AT_ASSUMED_RATE" : "NPV_ZERO_AT_ASSUMED_RATE",
            qualification: "REVIEW_REQUIRED", requiresHumanReview: true,
            assumptions: Object.freeze([
                "جریان‌های نقدی و نرخ تنزیل واردشده توسط کاربر هستند و مستقلاً تأیید نشده‌اند.",
                "سناریوها جریان‌های آتی را یکنواخت ۱۰٪ و ۲۰٪ تغییر می‌دهند؛ پیش‌بینی بازار نیستند."
            ]),
            limitations: Object.freeze([
                "این خروجی امکان‌سنجی مالی اولیه است، نه مطالعه کامل فنی، بازار، حقوقی، عملیاتی، محیط‌زیستی یا مالیاتی.",
                "سیگنال NPV فقط در چارچوب نرخ تنزیل مفروض تفسیر می‌شود و توصیه قطعی سرمایه‌گذاری نیست.",
                "اگر IRR قابل محاسبه نباشد، وضعیت BLOCKED حفظ می‌شود و صفر ساختگی نمایش داده نمی‌شود."
            ]),
        });
    }
}
