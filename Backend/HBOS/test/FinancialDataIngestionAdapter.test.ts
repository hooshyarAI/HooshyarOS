import { FinancialDataIngestionAdapter } from "../Engines/FinancialDataIngestionAdapter";

describe("FinancialDataIngestionAdapter", () => {
    it("exposes the canonical capability identity and health", () => {
        const engine = new FinancialDataIngestionAdapter();
        expect(engine.name).toBe("FinancialDataIngestionAdapter");
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability()).toEqual({
            id: "repair-product.financial-data-ingestion",
            capability: "repair and re-verify knot product.financial-data-ingestion from checkpoint 568a6271",
            targetEngine: "Financial Intelligence Engine"
        });
    });
});
