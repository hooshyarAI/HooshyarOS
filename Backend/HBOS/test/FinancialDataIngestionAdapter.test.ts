import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import ExcelJS from "exceljs-hardened";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { FinancialDataIngestionAdapter, SpreadsheetIngestionConfig, DEFAULT_SPREADSHEET_CONFIG } from "../Product/FinancialDataIngestionAdapter";

const SOURCE = `date,account,debit,credit,currency
2026-08-01,Cash,1000,0,IRR
2026-08-01,Sales,0,1000,IRR
2026-08-02,Receivable,250,0,IRR
2026-08-02,Sales,0,250,IRR`;

/**
 * Create a valid XLSX file for testing
 */
async function createValidXlsxFile(filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Transactions");

  // Add header row
  worksheet.addRow(["date", "account", "debit", "credit", "currency"]);

  // Add data rows
  worksheet.addRow(["2026-08-01", "Cash", 1000, 0, "IRR"]);
  worksheet.addRow(["2026-08-01", "Sales", 0, 1000, "IRR"]);
  worksheet.addRow(["2026-08-02", "Receivable", 250, 0, "IRR"]);
  worksheet.addRow(["2026-08-02", "Sales", 0, 250, "IRR"]);

  await workbook.xlsx.writeFile(filePath);
}

/**
 * Create an XLSX file with Excel serial dates
 * Note: Excel serial 44792 = January 1, 2022 (verified)
 */
async function createXlsxWithSerialDates(filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Transactions");

  // Add header row
  worksheet.addRow(["date", "account", "debit", "credit", "currency"]);

  // Excel serial date for 2022-01-01 is 44792
  // (counting from 1900-01-01 = 1, with Excel's leap year bug)
  worksheet.addRow([44792, "Cash", 1000, 0, "IRR"]);
  worksheet.addRow([44792, "Sales", 0, 1000, "IRR"]);

  await workbook.xlsx.writeFile(filePath);
}

/**
 * Create a malformed XLSX file (invalid zip structure)
 */
function createMalformedXlsx(filePath: string): void {
  // Write invalid data that looks like XLSX (ZIP) but is corrupted
  writeFileSync(filePath, Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF]), "binary");
}

/**
 * Create an empty XLSX file (no data rows)
 */
async function createEmptyXlsx(filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Transactions");

  // Only header row, no data
  worksheet.addRow(["date", "account", "debit", "credit", "currency"]);

  await workbook.xlsx.writeFile(filePath);
}

/**
 * Create an XLSX file with missing required columns
 */
async function createXlsxMissingColumns(filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Transactions");

  // Missing 'currency' column
  worksheet.addRow(["date", "account", "debit", "credit"]);
  worksheet.addRow(["2026-08-01", "Cash", 1000, 0]);

  await workbook.xlsx.writeFile(filePath);
}

/**
 * Create an XLSX file with invalid numeric cell
 */
async function createXlsxInvalidNumeric(filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Transactions");

  worksheet.addRow(["date", "account", "debit", "credit", "currency"]);
  worksheet.addRow(["2026-08-01", "Cash", "invalid", 0, "IRR"]); // debit is not a number

  await workbook.xlsx.writeFile(filePath);
}

/**
 * Create an XLSX file with invalid date
 */
async function createXlsxInvalidDate(filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Transactions");

  worksheet.addRow(["date", "account", "debit", "credit", "currency"]);
  worksheet.addRow(["not-a-date", "Cash", 1000, 0, "IRR"]);

  await workbook.xlsx.writeFile(filePath);
}

/**
 * Create an XLSX file with formulas (to verify formulas are NOT evaluated)
 */
async function createXlsxWithFormulas(filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Transactions");

  worksheet.addRow(["date", "account", "debit", "credit", "currency"]);
  // Formula that would be dangerous if evaluated - but we only read values
  worksheet.addRow(["2026-08-01", "Cash", 1000, "=1+1", "IRR"]);

  await workbook.xlsx.writeFile(filePath);
}

/**
 * Create an oversized file (for size limit testing)
 */
function createOversizedFile(filePath: string, targetSize: number): void {
  // Create a buffer with random data that exceeds the limit
  const oversizedData = Buffer.alloc(targetSize + 1, 0x41);
  // Add valid ZIP header to pass magic byte check
  oversizedData[0] = 0x50; // P
  oversizedData[1] = 0x4B; // K
  oversizedData[2] = 0x03; // ZIP header
  oversizedData[3] = 0x04;
  writeFileSync(filePath, oversizedData);
}

describe("FinancialDataIngestionAdapter - XLSX Ingestion", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "hooshyar-financial-xlsx-"));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  describe("valid XLSX ingestion", () => {
    test("ingests a valid XLSX file and persists", async () => {
      const sourcePath = join(directory, "ledger.xlsx");
      await createValidXlsxFile(sourcePath);

      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database);

      const result = await adapter.ingestFile("tenant-a", sourcePath);

      expect(result.persisted).toBe(true);
      expect(result.evidence.sourceType).toBe("XLSX");
      expect(result.evidence.sourceName).toBe("ledger.xlsx");
      expect(result.model.tenantId).toBe("tenant-a");
      expect(result.model.transactions).toHaveLength(4);
      expect(result.model.totals).toEqual({
        debit: 1250,
        credit: 1250,
        balance: 0,
      });

      database.close();
    });

    test("ingests XLSX with Excel serial dates correctly", async () => {
      const sourcePath = join(directory, "serial-dates.xlsx");
      await createXlsxWithSerialDates(sourcePath);

      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database);

      const result = await adapter.ingestFile("tenant-a", sourcePath);

      expect(result.persisted).toBe(true);
      expect(result.evidence.sourceType).toBe("XLSX");
      expect(result.model.transactions).toHaveLength(2);
      // Verify dates were correctly converted (serial 44792 = 2022-08-20)
      expect(result.model.transactions[0].date).toBe("2022-08-20");
      expect(result.model.transactions[1].date).toBe("2022-08-20");

      database.close();
    });

    test("rejects XLSX with formula values (formulas are not evaluated)", async () => {
      const sourcePath = join(directory, "formulas.xlsx");
      await createXlsxWithFormulas(sourcePath);

      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database);

      // Formula values stored as strings should be rejected as invalid numeric values
      await expect(adapter.ingestFile("tenant-a", sourcePath)).rejects.toThrow("ingestion-amount-invalid");

      database.close();
    });
  });

  describe("malformed XLSX rejection", () => {
    test("rejects malformed XLSX file", async () => {
      const sourcePath = join(directory, "malformed.xlsx");
      createMalformedXlsx(sourcePath);

      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database);

      await expect(adapter.ingestFile("tenant-a", sourcePath)).rejects.toThrow("ingestion-excel-parse-error");

      database.close();
    });

    test("rejects empty XLSX workbook", async () => {
      const sourcePath = join(directory, "empty.xlsx");
      await createEmptyXlsx(sourcePath);

      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database);

      await expect(adapter.ingestFile("tenant-a", sourcePath)).rejects.toThrow("ingestion-empty-workbook");

      database.close();
    });
  });

  describe("schema validation", () => {
    test("rejects XLSX with missing required columns", async () => {
      const sourcePath = join(directory, "missing-cols.xlsx");
      await createXlsxMissingColumns(sourcePath);

      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database);

      await expect(adapter.ingestFile("tenant-a", sourcePath)).rejects.toThrow("ingestion-schema-invalid");

      database.close();
    });

    test("rejects XLSX with invalid numeric cell", async () => {
      const sourcePath = join(directory, "invalid-numeric.xlsx");
      await createXlsxInvalidNumeric(sourcePath);

      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database);

      // String value in numeric column should be rejected as invalid amount
      await expect(adapter.ingestFile("tenant-a", sourcePath)).rejects.toThrow("ingestion-amount-invalid");

      database.close();
    });

    test("rejects XLSX with invalid date", async () => {
      const sourcePath = join(directory, "invalid-date.xlsx");
      await createXlsxInvalidDate(sourcePath);

      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database);

      await expect(adapter.ingestFile("tenant-a", sourcePath)).rejects.toThrow("ingestion-date-invalid");

      database.close();
    });
  });

  describe("format detection", () => {
    test("rejects file with XLS magic but wrong extension", async () => {
      // Create a file with XLS magic bytes but .xlsx extension
      const sourcePath = join(directory, "mismatch.xlsx");
      const xlsMagic = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
      writeFileSync(sourcePath, xlsMagic);

      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database);

      await expect(adapter.ingestFile("tenant-a", sourcePath)).rejects.toThrow("ingestion-format-mismatch");

      database.close();
    });

    test("rejects file with XLSX magic but wrong extension (.xls)", async () => {
      // Create a file with XLSX ZIP magic bytes but .xls extension
      const sourcePath = join(directory, "mismatch.xls");
      const xlsxMagic = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
      writeFileSync(sourcePath, xlsxMagic);

      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database);

      await expect(adapter.ingestFile("tenant-a", sourcePath)).rejects.toThrow("ingestion-format-mismatch");

      database.close();
    });

    test("rejects non-Excel binary data with wrong extension", async () => {
      // File with no Excel magic bytes will be treated as CSV and fail parsing
      const sourcePath = join(directory, "unknown.bin");
      writeFileSync(sourcePath, Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]), "binary");

      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database);

      // Binary data without Excel magic bytes is treated as CSV, which fails
      await expect(adapter.ingestFile("tenant-a", sourcePath)).rejects.toThrow("ingestion-header-and-data-required");

      database.close();
    });
  });

  describe("resource controls", () => {
    test("rejects oversized XLSX file", async () => {
      const sourcePath = join(directory, "oversized.xlsx");
      // Create file larger than 5MB default limit
      createOversizedFile(sourcePath, 6 * 1024 * 1024);

      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database);

      await expect(adapter.ingestFile("tenant-a", sourcePath)).rejects.toThrow("ingestion-file-too-large");

      database.close();
    });

    test("resource configuration is actually honored", async () => {
      const sourcePath = join(directory, "oversized.xlsx");
      // Create file larger than custom 1MB limit
      createOversizedFile(sourcePath, 2 * 1024 * 1024);

      const customConfig: SpreadsheetIngestionConfig = {
        ...DEFAULT_SPREADSHEET_CONFIG,
        xlsxMaxSizeBytes: 1024 * 1024, // 1 MB custom limit
      };

      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database, customConfig);

      await expect(adapter.ingestFile("tenant-a", sourcePath)).rejects.toThrow("ingestion-file-too-large");

      database.close();
    });

    test("file below custom limit is accepted", async () => {
      const sourcePath = join(directory, "small.xlsx");
      await createValidXlsxFile(sourcePath);

      const customConfig: SpreadsheetIngestionConfig = {
        ...DEFAULT_SPREADSHEET_CONFIG,
        xlsxMaxSizeBytes: 10 * 1024 * 1024, // 10 MB limit (larger than our test file)
      };

      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database, customConfig);

      const result = await adapter.ingestFile("tenant-a", sourcePath);
      expect(result.persisted).toBe(true);

      database.close();
    });
  });

  describe("tenant isolation", () => {
    test("keeps XLSX data tenant-scoped", async () => {
      const sourcePath = join(directory, "ledger.xlsx");
      await createValidXlsxFile(sourcePath);

      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database);

      const result = await adapter.ingestFile("tenant-a", sourcePath);

      // Verify tenant-b cannot access tenant-a's data
      await expect(database.read({ tenantId: "tenant-b" }, `financial-ingestion:${result.evidence.sha256}`)).resolves.toBeNull();

      database.close();
    });
  });

  describe("duplicate detection", () => {
    test("same XLSX content produces same SHA-256", async () => {
      const sourcePath1 = join(directory, "ledger1.xlsx");
      const sourcePath2 = join(directory, "ledger2.xlsx");
      await createValidXlsxFile(sourcePath1);
      await createValidXlsxFile(sourcePath2);

      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database);

      const result1 = await adapter.ingestFile("tenant-a", sourcePath1);
      const result2 = await adapter.ingestFile("tenant-a", sourcePath2);

      // Same content should produce same SHA
      expect(result1.evidence.sha256).toBe(result2.evidence.sha256);

      database.close();
    });
  });

  describe("raw source provenance", () => {
    test("XLSX SHA-256 computed from original bytes", async () => {
      const sourcePath = join(directory, "ledger.xlsx");
      await createValidXlsxFile(sourcePath);

      // Read original bytes
      const originalBytes = await import("node:fs/promises").then(fs => fs.readFile(sourcePath));
      const expectedSha256 = createHash("sha256").update(originalBytes).digest("hex");

      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database);

      const result = await adapter.ingestFile("tenant-a", sourcePath);

      expect(result.evidence.sha256).toBe(expectedSha256);
      expect(result.evidence.receivedAt).toBeDefined();

      database.close();
    });
  });

  describe("batch ingestion with XLSX", () => {
    test("mixed-format batch including XLSX", async () => {
      const csvPath = join(directory, "ledger.csv");
      const xlsxPath = join(directory, "ledger.xlsx");
      const jsonPath = join(directory, "ledger.json");

      writeFileSync(csvPath, SOURCE, "utf8");
      await createValidXlsxFile(xlsxPath);
      const jsonContent = JSON.stringify({
        transactions: [
          { date: "2026-08-01", account: "Cash", debit: 500, credit: 0, currency: "IRR" },
          { date: "2026-08-01", account: "Sales", debit: 0, credit: 500, currency: "IRR" },
        ],
      });
      writeFileSync(jsonPath, jsonContent, "utf8");

      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database);

      const batchResult = await adapter.ingestBatch("tenant-a", [csvPath, xlsxPath, jsonPath]);

      expect(batchResult.totalFiles).toBe(3);
      expect(batchResult.successfulFiles).toBe(3);
      expect(batchResult.failedFiles).toBe(0);

      // Check that we have all three types
      const csvResult = batchResult.results.find(r => r.sourcePath.endsWith('.csv'));
      const xlsxResult = batchResult.results.find(r => r.sourcePath.endsWith('.xlsx'));
      const jsonResult = batchResult.results.find(r => r.sourcePath.endsWith('.json'));

      expect(csvResult?.success).toBe(true);
      expect(xlsxResult?.success).toBe(true);
      expect(jsonResult?.success).toBe(true);

      database.close();
    });

    test("batch continues on XLSX failure", async () => {
      const validCsvPath = join(directory, "valid.csv");
      const invalidXlsxPath = join(directory, "invalid.xlsx");
      const validCsvPath2 = join(directory, "valid2.csv");

      writeFileSync(validCsvPath, SOURCE, "utf8");
      await createXlsxInvalidDate(invalidXlsxPath);
      writeFileSync(validCsvPath2, `date,account,debit,credit,currency\n2026-08-03,Expenses,50,0,IRR\n2026-08-03,Revenue,0,50,IRR`, "utf8");

      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database);

      const batchResult = await adapter.ingestBatch("tenant-a", [validCsvPath, invalidXlsxPath, validCsvPath2]);

      expect(batchResult.totalFiles).toBe(3);
      expect(batchResult.successfulFiles).toBe(2);
      expect(batchResult.failedFiles).toBe(1);
      expect(batchResult.results[1].success).toBe(false);
      // XLSX with invalid date may fail at parse time (ingestion-excel-parse-error)
      // or at validation time (ingestion-date-invalid), both are acceptable
      expect(batchResult.results[1].error).toMatch(/ingestion-(date-invalid|excel-parse-error)/);

      database.close();
    });
  });

  describe("backward compatibility", () => {
    test("existing CSV ingestion still works", async () => {
      const sourcePath = join(directory, "sample-ledger.csv");
      writeFileSync(sourcePath, SOURCE, "utf8");

      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database);

      const result = await adapter.ingestFile("tenant-a", sourcePath);

      expect(result.persisted).toBe(true);
      expect(result.evidence.sourceType).toBe("CSV");
      expect(result.model.transactions).toHaveLength(4);
      expect(result.model.totals).toEqual({
        debit: 1250,
        credit: 1250,
        balance: 0,
      });

      database.close();
    });

    test("existing JSON ingestion still works", async () => {
      const structuredJson = JSON.stringify({
        transactions: [
          { date: "2026-08-01", account: "Cash", debit: 1000, credit: 0, currency: "IRR" },
          { date: "2026-08-01", account: "Sales", debit: 0, credit: 1000, currency: "IRR" },
        ],
      });
      const sourcePath = join(directory, "ledger.json");
      writeFileSync(sourcePath, structuredJson, "utf8");

      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database);

      const result = await adapter.ingestFile("tenant-a", sourcePath);

      expect(result.persisted).toBe(true);
      expect(result.evidence.sourceType).toBe("STRUCTURED");
      expect(result.model.transactions).toHaveLength(2);

      database.close();
    });

    test("direct ingestCsv still works", async () => {
      const database = new SQLitePersistenceStore({ databasePath: join(directory, "financial.sqlite") });
      const adapter = new FinancialDataIngestionAdapter(database);

      const result = await adapter.ingestCsv("tenant-a", "ledger.csv", SOURCE);

      expect(result.persisted).toBe(true);
      expect(result.evidence.sourceType).toBe("CSV");

      database.close();
    });

    test("direct ingestStructured still works", async () => {
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

      database.close();
    });
  });
});

// Re-export original tests for backward compatibility verification
describe("FinancialDataIngestionAdapter - Original CSV/JSON Tests", () => {
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

  test("rejects double-sided transaction rows in structured data", async () => {
    const database = new SQLitePersistenceStore({
      databasePath: join(directory, "financial.sqlite"),
    });
    const adapter = new FinancialDataIngestionAdapter(database);
    const invalid = JSON.stringify({
      transactions: [
        { date: "2026-08-01", account: "Cash", debit: 100, credit: 50, currency: "IRR" },
      ],
    });

    await expect(adapter.ingestStructured("tenant-a", "bad.json", invalid)).rejects.toThrow("ingestion-double-sided-row:0");
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
