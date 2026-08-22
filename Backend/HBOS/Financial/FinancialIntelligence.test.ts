import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CsvFinancialIngestion } from "./CsvFinancialIngestion";
import { DurableFinancialEvidenceStore } from "./DurableFinancialEvidenceStore";
import { FinancialIngestionPipeline } from "./FinancialIngestionPipeline";
import { FinancialIntelligence } from "./FinancialIntelligence";

describe("FinancialIntelligence", () => {
    it("summarizes only persistent evidence belonging to the requested tenant", async () => {
        const root = await mkdtemp(join(tmpdir(), "hooshyar-financial-intelligence-"));
        const store = new DurableFinancialEvidenceStore(join(root, "financial.sqlite"));
        const pipeline = new FinancialIngestionPipeline(new CsvFinancialIngestion(), store);
        pipeline.ingest(
            "accountCode,accountName,transactionDate,debit,credit,description\n1000,Cash,2026-08-17,250,0,Opening\n2000,Revenue,2026-08-17,0,250,Sale",
            "tenant-a",
            "source-a"
        );
        pipeline.ingest(
            "accountCode,accountName,transactionDate,debit,credit,description\n3000,Other,2026-08-17,999,0,Other",
            "tenant-b",
            "source-b"
        );

        const insight = new FinancialIntelligence(store).summarizeTenant("tenant-a");
        expect(insight.totalDebit).toBe(250);
        expect(insight.totalCredit).toBe(250);
        expect(insight.balance).toBe(0);
        expect(insight.balanced).toBe(true);
        expect(insight.evidenceIds).toHaveLength(2);
        expect(insight.evidenceIds).not.toContain(store.listByTenant("tenant-b")[0].id);
        store.close();
        await rm(root, { recursive: true, force: true });
    });
});
