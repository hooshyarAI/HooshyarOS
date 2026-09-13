import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";
import { ReasoningEngine } from "../Engines/ReasoningEngine";
import { FinancialStatementAnalysisService } from "../Product/FinancialStatementAnalysisService";

describe("FinancialStatementAnalysisService", () => {
    const service = () =>
        new FinancialStatementAnalysisService(
            new FinancialIntelligenceEngine(),
            {
                reason: () => ({
                    problem: "verified financial statement analysis",
                    status: "ready",
                    success: true,
                }),
            } as Pick<ReasoningEngine, "reason">,
        );

    const input = {
        tenantId: "tenant-a",
        source: {
            sourceName: "statement.csv",
            sourceType: "CSV" as const,
            sha256: "a".repeat(64),
            receivedAt: "2026-08-26T00:00:00Z",
        },
        revenue: 1000,
        expenses: 600,
        assets: 2000,
        liabilities: 500,
    };

    it("exposes the canonical product boundary", () => {
        expect(service().capabilityId).toBe("product.financial-statement-analysis");
        expect(service().targetEngine).toBe("Financial Intelligence Engine");
        expect(service().initialize().status).toBe("READY");
    });

    it("analyzes normalized financial statements through existing engines", () => {
        const result = service().execute(input);

        expect(result.status).toBe("READY");
        expect(result.tenantId).toBe("tenant-a");
        expect(result.metrics.profit).toBe(400);
        expect(result.metrics.profitMargin).toBe(0.4);
        expect(result.metrics.debtRatio).toBe(0.25);
        expect(result.observations[0]?.code).toBe("PROFITABLE");
        expect(result.reasoningEvidence.success).toBe(true);
    });

    it("rejects missing tenant boundary", () => {
        expect(() =>
            service().execute({
                ...input,
                tenantId: " ",
            }),
        ).toThrow("financial-statement-analysis-tenant-required");
    });

    it("rejects invalid source evidence", () => {
        expect(() =>
            service().execute({
                ...input,
                source: {
                    ...input.source,
                    sha256: "invalid",
                },
            }),
        ).toThrow("financial-statement-analysis-source-evidence-invalid");
    });
});
