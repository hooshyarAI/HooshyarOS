import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CsvFinancialIngestion } from "./CsvFinancialIngestion";
import { DurableFinancialEvidenceStore } from "./DurableFinancialEvidenceStore";
import { FinancialIngestionPipeline } from "./FinancialIngestionPipeline";

describe("FinancialIngestionPipeline", () => {
    it("persists every validated canonical record as evidence", async () => {
        const root = await mkdtemp(join(tmpdir(), "hooshyar-ingestion-pipeline-"));
        const databasePath = join(root, "financial.sqlite");
        const store = new DurableFinancialEvidenceStore(databasePath);
        const pipeline = new FinancialIngestionPipeline(new CsvFinancialIngestion(), store);
        const result = pipeline.ingest(
            "accountCode,accountName,transactionDate,debit,credit,description\n1000,Cash,2026-08-17,100,0,Opening\n2000,Revenue,2026-08-17,0,100,Sale",
            "tenant-a",
            "csv-2026-08-17"
        );
        expect(result.records).toHaveLength(2);
        expect(result.evidence).toHaveLength(2);
        expect(store.listByTenant("tenant-a")).toHaveLength(2);
        store.close();
        await rm(root, { recursive: true, force: true });
    });

    it("rejects invalid input before persistence", async () => {
        const root = await mkdtemp(join(tmpdir(), "hooshyar-ingestion-pipeline-invalid-"));
        const databasePath = join(root, "financial.sqlite");
        const store = new DurableFinancialEvidenceStore(databasePath);
        const pipeline = new FinancialIngestionPipeline(new CsvFinancialIngestion(), store);
        expect(() => pipeline.ingest(
            "accountCode,accountName,transactionDate,debit,credit,description\n1000,Cash,not-a-date,100,0,Bad",
            "tenant-a",
            "invalid-source"
        )).toThrow();
        expect(store.listByTenant("tenant-a")).toEqual([]);
        store.close();
        await rm(root, { recursive: true, force: true });
    });
});
