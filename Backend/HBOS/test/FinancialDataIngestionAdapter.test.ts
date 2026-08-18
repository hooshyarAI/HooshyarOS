import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FinancialDataIngestionAdapter } from "../Product/FinancialDataIngestionAdapter";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";

describe("FinancialDataIngestionAdapter", () => {
    let tempDir: string;
    let persistence: SQLitePersistenceStore;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), "hooshyar-financial-ingestion-"));
        persistence = new SQLitePersistenceStore({ databasePath: join(tempDir, "financial.sqlite") });
    });

    afterEach(async () => {
        persistence.close();
        await rm(tempDir, { recursive: true, force: true });
    });

    it("ingests CSV, normalizes financial records and persists tenant-scoped evidence", async () => {
        const csv = [
            "date,account,debit,credit,currency",
            "2026-01-01,1000,100.00,0,IRR",
            "2026-01-02,2000,0,30.50,IRR"
        ].join("\n");

        const result = await new FinancialDataIngestionAdapter(persistence).ingestCsv(
            "tenant-a",
            "sample.csv",
            csv,
        );

        expect(result.evidence.sourceName).toBe("sample.csv");
        expect(result.evidence.sourceType).toBe("CSV");
        expect(result.model.tenantId).toBe("tenant-a");
        expect(result.model.transactions).toHaveLength(2);
        expect(result.model.totals).toEqual({ debit: 100, credit: 30.5, balance: 69.5 });
        expect(result.persisted).toBe(true);

        const persisted = await persistence.read(
            { tenantId: "tenant-a" },
            `financial-ingestion:${result.evidence.sha256}`,
        );
        expect(persisted?.value).toEqual(result.model);
    });

    it("rejects an invalid financial CSV schema before persistence", async () => {
        await expect(
            new FinancialDataIngestionAdapter(persistence).ingestCsv(
                "tenant-a",
                "invalid.csv",
                "date,account\n2026-01-01,1000",
            ),
        ).rejects.toThrow("ingestion-schema-invalid");
    });
});
