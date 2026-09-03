import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { FinancialDataIngestionAdapter } from "../Product/FinancialDataIngestionAdapter";

const SOURCE = `date,account,debit,credit,currency
2026-08-01,Cash,1000,0,IRR
2026-08-01,Sales,0,1000,IRR
2026-08-02,Receivable,250,0,IRR
2026-08-02,Sales,0,250,IRR`;

describe("FinancialDataIngestionAdapter", () => {
    let directory: string;

    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), "hooshyar-financial-ingestion-"));
    });

    afterEach(() => {
        rmSync(directory, { recursive: true, force: true });
    });

    test("ingests an actual CSV file and survives database restart", async () => {
        const sourcePath = join(directory, "sample-ledger.csv");
        writeFileSync(sourcePath, SOURCE, "utf8");

        const databasePath = join(directory, "financial.sqlite");
        const database = new SQLitePersistenceStore({ databasePath });
        const adapter = new FinancialDataIngestionAdapter(database);

        const result = await adapter.ingestFile("tenant-a", sourcePath);
        const expectedHash = createHash("sha256")
            .update(SOURCE, "utf8")
            .digest("hex");

        expect(result.persisted).toBe(true);
        expect(result.evidence.sourceName).toBe("sample-ledger.csv");
        expect(result.evidence.sha256).toBe(expectedHash);
        expect(result.model.tenantId).toBe("tenant-a");
        expect(result.model.transactions).toHaveLength(4);
        expect(result.model.totals).toEqual({
            debit: 1250,
            credit: 1250,
            balance: 0,
        });

        database.close();

        const reopened = new SQLitePersistenceStore({ databasePath });

        await expect(
            reopened.read(
                { tenantId: "tenant-a" },
                `financial-ingestion:${expectedHash}`,
            ),
        ).resolves.toMatchObject({
            tenantId: "tenant-a",
            value: result.model,
        });

        reopened.close();
    });

    test("keeps financial data tenant-scoped", async () => {
        const database = new SQLitePersistenceStore({
            databasePath: join(directory, "financial.sqlite"),
        });

        const adapter = new FinancialDataIngestionAdapter(database);
        const result = await adapter.ingestCsv("tenant-a", "ledger.csv", SOURCE);

        await expect(
            database.read(
                { tenantId: "tenant-b" },
                `financial-ingestion:${result.evidence.sha256}`,
            ),
        ).resolves.toBeNull();

        database.close();
    });

    test("rejects invalid financial rows before persistence", async () => {
        const database = new SQLitePersistenceStore({
            databasePath: join(directory, "financial.sqlite"),
        });

        const adapter = new FinancialDataIngestionAdapter(database);

        const invalid =
            `date,account,debit,credit,currency\n` +
            `2026-08-01,Cash,100,50,IRR`;

        await expect(
            adapter.ingestCsv("tenant-a", "bad.csv", invalid),
        ).rejects.toThrow("ingestion-double-sided-row:2");

        database.close();
    });

    test("ingests a valid JSON (STRUCTURED) file and persists", async () => {
        const structuredJson = JSON.stringify({
            transactions: [
                { date: "2026-08-01", account: "Cash", debit: 1000, credit: 0, currency: "IRR" },
                { date: "2026-08-01", account: "Sales", debit: 0, credit: 1000, currency: "IRR" },
            ],
        });
        const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
        const adapter = new FinancialDataIngestionAdapter(database);

        const result = await adapter.ingestStructured("tenant-a", "ledger.json", structuredJson);

        expect(result.persisted).toBe(true);
        expect(result.evidence.sourceType).toBe("STRUCTURED");
        expect(result.evidence.sourceName).toBe("ledger.json");
        expect(result.model.tenantId).toBe("tenant-a");
        expect(result.model.transactions).toHaveLength(2);
        expect(result.model.totals).toEqual({ debit: 1000, credit: 1000, balance: 0 });
        database.close();
    });

    test("rejects malformed JSON before persistence", async () => {
        const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
        const adapter = new FinancialDataIngestionAdapter(database);

        await expect(adapter.ingestStructured("tenant-a", "bad.json", "{ invalid json")).rejects.toThrow("ingestion-json-parse-error");
        database.close();
    });

    test("rejects schema-invalid structured data", async () => {
        const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
        const adapter = new FinancialDataIngestionAdapter(database);

        await expect(adapter.ingestStructured("tenant-a", "bad.json", JSON.stringify({ notTransactions: [] }))).rejects.toThrow("ingestion-structured-schema-invalid");
        database.close();
    });

    test("rejects double-sided transaction rows in structured data", async () => {
        const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
        const adapter = new FinancialDataIngestionAdapter(database);
        const invalid = JSON.stringify({
            transactions: [
                { date: "2026-08-01", account: "Cash", debit: 100, credit: 50, currency: "IRR" },
            ],
        });

        await expect(adapter.ingestStructured("tenant-a", "bad.json", invalid)).rejects.toThrow("ingestion-double-sided-row:0");
        database.close();
    });

    test("dispatches .json files to ingestStructured via ingestFile", async () => {
        const structuredJson = JSON.stringify({
            transactions: [
                { date: "2026-08-01", account: "Cash", debit: 500, credit: 0, currency: "IRR" },
                { date: "2026-08-01", account: "Sales", debit: 0, credit: 500, currency: "IRR" },
            ],
        });
        const sourcePath = join(directory, "ledger.json");
        writeFileSync(sourcePath, structuredJson, "utf8");
        const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
        const adapter = new FinancialDataIngestionAdapter(database);

        const result = await adapter.ingestFile("tenant-a", sourcePath);

        expect(result.evidence.sourceType).toBe("STRUCTURED");
        expect(result.model.totals).toEqual({ debit: 500, credit: 500, balance: 0 });
        database.close();
    });

    test("keeps structured data tenant-scoped", async () => {
        const structuredJson = JSON.stringify({
            transactions: [
                { date: "2026-08-01", account: "Cash", debit: 1000, credit: 0, currency: "IRR" },
                { date: "2026-08-01", account: "Sales", debit: 0, credit: 1000, currency: "IRR" },
            ],
        });
        const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
        const adapter = new FinancialDataIngestionAdapter(database);
        const result = await adapter.ingestStructured("tenant-a", "ledger.json", structuredJson);

        await expect(database.read({ tenantId: "tenant-b" }, `financial-ingestion:${result.evidence.sha256}`)).resolves.toBeNull();
        database.close();
    });

    test("ingests multiple files in a batch operation", async () => {
        const sourcePath1 = join(directory, "ledger1.csv");
        const sourcePath2 = join(directory, "ledger2.csv");
        const structuredJson = JSON.stringify({
            transactions: [
                { date: "2026-08-01", account: "Cash", debit: 500, credit: 0, currency: "IRR" },
                { date: "2026-08-01", account: "Sales", debit: 0, credit: 500, currency: "IRR" },
            ],
        });
        const sourcePath3 = join(directory, "ledger3.json");
        writeFileSync(sourcePath1, SOURCE, "utf8");
        writeFileSync(sourcePath2, `date,account,debit,credit,currency\n2026-08-03,Expenses,100,0,IRR\n2026-08-03,Revenue,0,100,IRR`, "utf8");
        writeFileSync(sourcePath3, structuredJson, "utf8");

        const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
        const adapter = new FinancialDataIngestionAdapter(database);

        const batchResult = await adapter.ingestBatch("tenant-a", [sourcePath1, sourcePath2, sourcePath3]);

        expect(batchResult.totalFiles).toBe(3);
        expect(batchResult.successfulFiles).toBe(3);
        expect(batchResult.failedFiles).toBe(0);
        expect(batchResult.tenantId).toBe("tenant-a");
        expect(batchResult.results).toHaveLength(3);
        expect(batchResult.results[0].success).toBe(true);
        expect(batchResult.results[1].success).toBe(true);
        expect(batchResult.results[2].success).toBe(true);
        expect(batchResult.results[2].evidence?.sourceType).toBe("STRUCTURED");
        database.close();
    });

    test("batch ingestion continues on individual file failure", async () => {
        const sourcePath1 = join(directory, "valid.csv");
        const sourcePath2 = join(directory, "invalid.csv");
        const sourcePath3 = join(directory, "valid2.csv");
        writeFileSync(sourcePath1, SOURCE, "utf8");
        writeFileSync(sourcePath2, `date,account,debit,credit,currency\n2026-08-01,Cash,100,50,IRR`, "utf8");
        writeFileSync(sourcePath3, `date,account,debit,credit,currency\n2026-08-03,Expenses,50,0,IRR\n2026-08-03,Revenue,0,50,IRR`, "utf8");

        const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
        const adapter = new FinancialDataIngestionAdapter(database);

        const batchResult = await adapter.ingestBatch("tenant-a", [sourcePath1, sourcePath2, sourcePath3]);

        expect(batchResult.totalFiles).toBe(3);
        expect(batchResult.successfulFiles).toBe(2);
        expect(batchResult.failedFiles).toBe(1);
        expect(batchResult.results[0].success).toBe(true);
        expect(batchResult.results[1].success).toBe(false);
        expect(batchResult.results[1].error).toContain("ingestion-double-sided-row");
        expect(batchResult.results[2].success).toBe(true);
        database.close();
    });

    test("rejects batch ingestion with empty file list", async () => {
        const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
        const adapter = new FinancialDataIngestionAdapter(database);

        await expect(adapter.ingestBatch("tenant-a", [])).rejects.toThrow("ingestion-batch-empty");
        database.close();
    });

    test("rejects batch ingestion without tenant", async () => {
        const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
        const adapter = new FinancialDataIngestionAdapter(database);
        const sourcePath = join(directory, "ledger.csv");
        writeFileSync(sourcePath, SOURCE, "utf8");

        await expect(adapter.ingestBatch("", [sourcePath])).rejects.toThrow("ingestion-tenant-required");
        database.close();
    });

    test("batch ingestion keeps all data tenant-scoped", async () => {
        const sourcePath1 = join(directory, "ledger1.csv");
        const sourcePath2 = join(directory, "ledger2.csv");
        writeFileSync(sourcePath1, SOURCE, "utf8");
        writeFileSync(sourcePath2, `date,account,debit,credit,currency\n2026-08-03,Expenses,100,0,IRR\n2026-08-03,Revenue,0,100,IRR`, "utf8");

        const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
        const adapter = new FinancialDataIngestionAdapter(database);

        const batchResult = await adapter.ingestBatch("tenant-a", [sourcePath1, sourcePath2]);

        // Verify tenant-b cannot access tenant-a's data
        const evidence1 = batchResult.results[0].evidence!;
        await expect(database.read({ tenantId: "tenant-b" }, `financial-ingestion:${evidence1.sha256}`)).resolves.toBeNull();
        database.close();
    });
});
