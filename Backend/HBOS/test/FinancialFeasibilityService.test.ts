import { FinancialFeasibilityService } from "../Product/FinancialFeasibilityService";

describe("product.financial-feasibility — composition over canonical engines", () => {
    const service = new FinancialFeasibilityService();
    const input = { tenantId: "tenant-a", projectName: "Factory", currency: "IRR", initialInvestment: 1000, cashFlows: [400, 400, 400, 400], discountRate: 0.1 };

    test("calculates NPV, IRR, payback and five sensitivity scenarios", () => {
        const original = [...input.cashFlows];
        const result = service.execute(input);
        expect(result.status).toBe("READY");
        if (result.status !== "READY") return;
        expect(result.npv.status).toBe("READY");
        expect(result.npv.npv).toBeGreaterThan(0);
        expect(result.irr.status).toBe("READY");
        expect(result.payback.paybackPeriod).toBeCloseTo(2.5, 6);
        expect(result.cashFlowScenarios.entries).toHaveLength(5);
        expect(result.cashFlowScenarios.entries[0].output).toBeLessThan(result.cashFlowScenarios.entries[2].output);
        expect(result.cashFlowScenarios.entries[4].output).toBeGreaterThan(result.cashFlowScenarios.entries[2].output);
        expect(result.qualification).toBe("REVIEW_REQUIRED");
        expect(result.requiresHumanReview).toBe(true);
        expect(input.cashFlows).toEqual(original);
    });

    test("does not fabricate IRR when cash flows do not support convergence", () => {
        const result = service.execute({ ...input, cashFlows: [-50, -25, -10] });
        expect(result.status).toBe("READY");
        if (result.status !== "READY") return;
        expect(result.npv.npv).toBeLessThan(0);
        expect(result.irr.status).toBe("BLOCKED");
    });

    test("fails closed on invalid tenant, investment, rate and cash flows", () => {
        expect(service.execute({ ...input, tenantId: " " })).toEqual({ status: "BLOCKED", reason: "FEASIBILITY_TENANT_REQUIRED" });
        expect(service.execute({ ...input, initialInvestment: 0 })).toEqual({ status: "BLOCKED", reason: "FEASIBILITY_INITIAL_INVESTMENT_INVALID" });
        expect(service.execute({ ...input, discountRate: -0.1 })).toEqual({ status: "BLOCKED", reason: "FEASIBILITY_DISCOUNT_RATE_INVALID" });
        expect(service.execute({ ...input, cashFlows: [1, Number.NaN] })).toEqual({ status: "BLOCKED", reason: "FEASIBILITY_CASH_FLOWS_INVALID" });
    });
});
