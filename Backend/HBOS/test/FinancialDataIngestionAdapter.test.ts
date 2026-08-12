import { FinancialDataIngestionAdapter } from "../Product/FinancialDataIngestionAdapter";

describe("FinancialDataIngestionAdapter", () => {
    it("exposes the canonical product boundary", () => {
        const adapter = new FinancialDataIngestionAdapter();
        expect(adapter.capabilityId).toBe("product.financial-data-ingestion");
        expect(adapter.targetEngine).toBe("Financial Intelligence Engine");
        expect(adapter.initialize().status).toBe("READY");
    });

    it("normalizes repository-supported record keys without inventing domain semantics", () => {
        const result = new FinancialDataIngestionAdapter().ingest([{ " account ": "100", amount: 12 }]);
        expect(result).toEqual([{ account: "100", amount: 12 }]);
    });
});
