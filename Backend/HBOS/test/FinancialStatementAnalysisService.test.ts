import { FinancialStatementAnalysisService } from "../Product/FinancialStatementAnalysisService";

describe("FinancialStatementAnalysisService", () => {
    it("exposes the canonical product boundary", () => {
        const service = new FinancialStatementAnalysisService();
        expect(service.capabilityId).toBe("product.financial-statement-analysis");
        expect(service.targetEngine).toBe("Financial Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new FinancialStatementAnalysisService().execute("continue").status).toBe("READY");
        expect(new FinancialStatementAnalysisService().execute(" ").status).toBe("BLOCKED");
    });
});
