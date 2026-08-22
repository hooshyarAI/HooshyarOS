import { CommercialDataIngestionPolicy } from "./CommercialDataIngestionPolicy";

describe("CommercialDataIngestionPolicy", () => {
    const policy = new CommercialDataIngestionPolicy();

    it("ingests existing sources without requiring employee re-entry while preserving human review", () => {
        const sources = [
            "IMAGE", "VIDEO", "PAPER", "PDF", "WORD", "EXCEL", "ACCESS",
            "ACCOUNTING_SOFTWARE", "ERP", "API", "DATABASE",
        ] as const;

        for (const kind of sources) {
            const result = policy.evaluate({ kind });
            expect(result.automatedIngestion).toBe(true);
            expect(result.manualDataEntryRequired).toBe(false);
        }

        expect(policy.evaluate({ kind: "PDF" }).requiresHumanReview).toBe(true);
        expect(policy.evaluate({ kind: "ERP", connector: "canonical" }).requiresHumanReview).toBe(false);
    });
});
