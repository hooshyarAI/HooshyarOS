import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FinancialDataIngestionAdapter } from "../Product/FinancialDataIngestionAdapter";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";

describe("FinancialDataIngestionAdapter", () => {
    let tempDir: string;
    let allowedRoot: string;
    let persistence: SQLitePersistenceStore;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), "hooshyar-financial-ingestion-"));
        allowedRoot = join(tempDir, "allowed");
        await mkdir(allowedRoot, { recursive: true });
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

    it("ingests an actual CSV file within the configured allowed root", async () => {
        const sourcePath = join(allowedRoot, "sample.csv");
        await writeFile(sourcePath, [
            "date,account,debit,credit,currency",
            "2026-01-01,1000,100.00,0,IRR",
            "2026-01-02,2000,0,30.50,IRR"
        ].join("\n"));

        const adapter = new FinancialDataIngestionAdapter(persistence, undefined, allowedRoot);
        const result = await adapter.ingestFile("tenant-a", sourcePath);

        expect(result.evidence.sourceName).toBe("sample.csv");
        expect(result.model.transactions).toHaveLength(2);
        expect(result.persisted).toBe(true);
    });

    it("ingests an actual CSV file and survives database restart within the configured allowed root", async () => {
        const source = [
            "date,account,debit,credit,currency",
            "2026-08-01,Cash,1000,0,IRR",
            "2026-08-01,Sales,0,1000,IRR",
            "2026-08-02,Receivable,250,0,IRR",
            "2026-08-02,Sales,0,250,IRR"
        ].join("\n");
        const sourcePath = join(allowedRoot, "sample-ledger.csv");
        await writeFile(sourcePath, source, "utf8");

        const databasePath = join(tempDir, "restart.sqlite");
        const database = new SQLitePersistenceStore({ databasePath });
        const adapter = new FinancialDataIngestionAdapter(database, undefined, allowedRoot);
        const result = await adapter.ingestFile("tenant-a", sourcePath);
        const expectedHash = createHash("sha256").update(source, "utf8").digest("hex");

        expect(result.persisted).toBe(true);
        expect(result.evidence.sha256).toBe(expectedHash);
        expect(result.model.transactions).toHaveLength(4);
        expect(result.model.totals).toEqual({ debit: 1250, credit: 1250, balance: 0 });
        database.close();

        const reopened = new SQLitePersistenceStore({ databasePath });
        await expect(reopened.read(
            { tenantId: "tenant-a" },
            `financial-ingestion:${expectedHash}`,
        )).resolves.toMatchObject({ tenantId: "tenant-a", value: result.model });
        reopened.close();
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

    it("rejects file ingestion outside the configured allowed root", async () => {
        const outside = join(tempDir, "outside.csv");
        await writeFile(outside, [
            "date,account,debit,credit,currency",
            "2026-01-01,1000,1,0,IRR",
        ].join("\n"));

        await expect(
            new FinancialDataIngestionAdapter(persistence, undefined, allowedRoot).ingestFile(
                "tenant-a",
                outside,
            ),
        ).rejects.toThrow("ingestion-source-path-outside-allowed-root");
    });
});
