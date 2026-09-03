import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import ExcelJS from "exceljs-hardened";
import { SQLitePersistenceStore } from "./SQLitePersistenceStore";
import { decodeTextBytes } from "./TextFileDecoder";

export type TxtEncoding = "UTF-8" | "UTF-8-BOM" | "UTF-16LE" | "UTF-16BE";

export interface TxtIngestionResult extends FinancialIngestionResult {
  readonly encoding: TxtEncoding;
}

export type SourceType = "CSV" | "STRUCTURED" | "XLS" | "XLSX";

export interface FinancialSourceEvidence {
  readonly sourceName: string;
  readonly sourceType: SourceType;
  readonly sha256: string;
  readonly receivedAt: string;
}

export interface FinancialTransaction {
  readonly date: string;
  readonly account: string;
  readonly debit: number;
  readonly credit: number;
  readonly currency: string;
}

export interface FinancialCanonicalModel {
  readonly tenantId: string;
  readonly source: FinancialSourceEvidence;
  readonly transactions: readonly FinancialTransaction[];
  readonly totals: {
    readonly debit: number;
    readonly credit: number;
    readonly balance: number;
  };
}

export interface FinancialIngestionResult {
  readonly evidence: FinancialSourceEvidence;
  readonly model: FinancialCanonicalModel;
  readonly persisted: boolean;
}

/**
 * Result of a single file in a batch ingestion operation
 */
export interface BatchIngestionItem {
  readonly sourcePath: string;
  readonly success: boolean;
  readonly evidence?: FinancialSourceEvidence;
  readonly error?: string;
}

/**
 * Result of a batch ingestion operation
 */
export interface BatchIngestionResult {
  readonly tenantId: string;
  readonly totalFiles: number;
  readonly successfulFiles: number;
  readonly failedFiles: number;
  readonly results: ReadonlyArray<BatchIngestionItem>;
}

// ============================================================================
// Universal File Source Contract (Stage 08-F.1)
// Supporting contract under the existing FinancialDataIngestionAdapter.
// Defines the canonical pre-ingestion representation that all current and
// future acquisition routes (CSV, JSON/STRUCTURED, XLSX, and future TXT/PDF/
// image/API/DB sources) can share. XLS is NOT included â€” it remains a local
// dependency blocker (see 08-S.5). This contract is intentionally minimal
// and does not create a new Engine or duplicate ingestion ownership.
// ============================================================================

/**
 * File source types currently supported by the canonical ingestion owner.
 * XLS is deliberately absent â€” it is BLOCKED on dependency resolution.
 * The union is open to extension as new format routes are added.
 */
export type FileSourceType = "CSV" | "STRUCTURED" | "XLSX";

/**
 * IANA-style media type identifiers for the supported file sources.
 * Extensible: future TXT/PDF/IMAGE/API/DB routes will add their own values
 * without breaking existing consumers.
 */
export type FileSourceMediaType =
  | "text/csv"
  | "application/json"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Reference to the persisted raw bytes of a file source.
 * The raw bytes themselves are stored via the existing canonical
 * SQLitePersistenceStore boundary, tenant-scoped at the persistence layer.
 * This ref is a truthful pointer â€” no fake storage is claimed.
 *
 * Format: "raw-source:<sha256>"
 * The sha256 acts as both content-identity and lookup key, so duplicate
 * raw content is naturally deduplicated at the persistence layer.
 */
export interface RawSourceRef {
  readonly persistenceKey: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly persisted: boolean;
}

/**
 * Universal File Source Contract.
 *
 * Represents a single acquired file at the boundary BEFORE it is parsed into
 * a FinancialCanonicalModel. Future format routes (TXT, PDF, image, OCR,
 * API, DB) will produce this same contract, allowing the downstream
 * validation, normalization, tenant-scoping, and persistence pipeline to
 * remain unchanged.
 *
 * Distinguished from FinancialSourceEvidence:
 *   - FileSource is the PRE-ingestion, byte-grounded source-of-truth.
 *   - FinancialSourceEvidence is the POST-ingestion, compact summary
 *     embedded inside the canonical model.
 * Both coexist; neither replaces the other.
 */
export interface FileSource {
  readonly sourceName: string;
  readonly sourceType: FileSourceType;
  readonly mediaType: FileSourceMediaType;
  readonly sha256: string;
  readonly receivedAt: string;
  readonly byteLength: number;
  readonly rawSourceRef: RawSourceRef;
}

/**
 * Compute SHA-256 of arbitrary content.
 * Exported so future routes can share the same hashing primitive.
 */
export function computeSourceSha256(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Factory: build a RawSourceRef for the given content.
 * The reference is a truthful pointer; the actual persistence happens at
 * the adapter layer against the canonical SQLitePersistenceStore.
 */
export function createRawSourceRef(content: Buffer | string): RawSourceRef {
  const sha256 = computeSourceSha256(content);
  const byteLength = typeof content === "string"
    ? Buffer.byteLength(content, "utf8")
    : content.length;
  return {
    persistenceKey: `raw-source:${sha256}`,
    sha256,
    byteLength,
    persisted: false,
  };
}

/**
 * Factory: build a FileSource.
 *
 * - Validates required identity fields (non-empty sourceName, non-empty sha256,
 *   non-empty receivedAt, non-negative byteLength, valid sourceType/mediaType).
 * - Computes the SHA-256 from the supplied raw bytes.
 * - The rawSourceRef is constructed but NOT persisted here â€” persistence is
 *   the caller's responsibility (preserves the existing tenant-scoped
 *   persistence boundary).
 *
 * `receivedAt` defaults to the current time as an ISO-8601 UTC string.
 */
export function createFileSource(params: {
  readonly sourceName: string;
  readonly sourceType: FileSourceType;
  readonly mediaType: FileSourceMediaType;
  readonly rawBytes: Buffer | string;
  readonly receivedAt?: string;
}): FileSource {
  const sourceName = params.sourceName.trim();
  if (!sourceName) {
    throw new Error("file-source-name-required");
  }

  const rawSourceRef = createRawSourceRef(params.rawBytes);
  if (rawSourceRef.byteLength < 0) {
    throw new Error("file-source-byte-length-invalid");
  }

  const receivedAt = params.receivedAt ?? new Date().toISOString();
  if (typeof receivedAt !== "string" || !receivedAt.trim()) {
    throw new Error("file-source-received-at-required");
  }

  return {
    sourceName,
    sourceType: params.sourceType,
    mediaType: params.mediaType,
    sha256: rawSourceRef.sha256,
    receivedAt,
    byteLength: rawSourceRef.byteLength,
    rawSourceRef,
  };
}

/**
 * Configuration for spreadsheet ingestion resource controls
 * These are initial policy values, NOT scientifically verified thresholds
 */
export interface SpreadsheetIngestionConfig {
  /** Maximum file size for XLS in bytes (default: 10 MB) */
  readonly xlsMaxSizeBytes: number;
  /** Maximum parse time for XLS in milliseconds (default: 60 s) */
  readonly xlsParseBudgetMs: number;
  /** Maximum file size for XLSX in bytes (default: 5 MB) */
  readonly xlsxMaxSizeBytes: number;
  /** Maximum zip entry size for XLSX in bytes (default: 128 MB) */
  readonly xlsxZipEntryLimitBytes: number;
  /** Maximum total uncompressed size for XLSX in bytes (default: 512 MB) */
  readonly xlsxTotalUncompressedLimitBytes: number;
}

/** Default spreadsheet ingestion configuration - INITIAL POLICY VALUES */
export const DEFAULT_SPREADSHEET_CONFIG: SpreadsheetIngestionConfig = {
  xlsMaxSizeBytes: 10 * 1024 * 1024, // 10 MB
  xlsParseBudgetMs: 60 * 1000, // 60 s
  xlsxMaxSizeBytes: 5 * 1024 * 1024, // 5 MB
  xlsxZipEntryLimitBytes: 128 * 1024 * 1024, // 128 MB
  xlsxTotalUncompressedLimitBytes: 512 * 1024 * 1024, // 512 MB
};

/**
 * Magic bytes for format detection
 */
const XLS_MAGIC_BYTES = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
const XLSX_ZIP_MAGIC_BYTES = Buffer.from([0x50, 0x4B, 0x03, 0x04]);

/**
 * Detect format from magic bytes
 */
function detectFormatFromMagicBytes(buffer: Buffer): SourceType | null {
  if (buffer.length >= 8 && XLS_MAGIC_BYTES.equals(buffer.subarray(0, 8))) {
    return "XLS";
  }
  if (buffer.length >= 4 && XLSX_ZIP_MAGIC_BYTES.equals(buffer.subarray(0, 4))) {
    return "XLSX";
  }
  return null;
}

/**
 * Validate extension matches detected format
 */
function validateExtensionMatchesFormat(sourceName: string, detectedFormat: SourceType): void {
  const ext = sourceName.toLowerCase().split('.').pop();
  if (ext === "xls" && detectedFormat !== "XLS") {
    throw new Error("ingestion-format-mismatch");
  }
  if (ext === "xlsx" && detectedFormat !== "XLSX") {
    throw new Error("ingestion-format-mismatch");
  }
  // Also reject unsupported extensions that might slip through
  if ((ext === "xls" || ext === "xlsx") && detectedFormat !== "XLS" && detectedFormat !== "XLSX") {
    throw new Error("ingestion-format-unsupported");
  }
}

/**
 * Excel serial date converter
 * Excel dates are stored as days since 1900-01-01 (with a leap year bug)
 * @param serial Excel serial date number
 * @returns ISO date string (YYYY-MM-DD) in UTC
 */
function excelSerialToDate(serial: number): string {
  // Excel's epoch is 1900-01-01 (serial 1)
  // But Excel incorrectly assumes 1900 was a leap year
  // So we subtract 1 for dates after 1900-02-28
  const EXCEL_EPOCH = new Date(Date.UTC(1900, 0, 1));
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  // If serial is 0 or negative, it's invalid
  if (!Number.isFinite(serial) || serial <= 0) {
    throw new Error("ingestion-date-invalid");
  }

  // Account for Excel's leap year bug
  let daysToAdd = serial;
  if (serial > 60) {
    daysToAdd -= 1;
  }

  const date = new Date(EXCEL_EPOCH.getTime() + daysToAdd * MS_PER_DAY);

  // Validate the result is a real date
  if (!Number.isFinite(date.getTime())) {
    throw new Error("ingestion-date-invalid");
  }

  // Return as UTC date string to avoid timezone shifts
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Parse a cell value from Excel, handling various types
 * Returns null for empty cells, throws for invalid data
 */
function parseExcelCellValue(value: unknown, row: number, field: string): string | number {
  if (value === null || value === undefined || value === "") {
    return ""; // Empty cell
  }

  // String value
  if (typeof value === "string") {
    return value.trim();
  }

  // Number value (including dates stored as numbers)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`ingestion-cell-invalid:${field}:${row}`);
    }
    return value;
  }

  // Boolean
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  // Unsupported type
  throw new Error(`ingestion-cell-invalid:${field}:${row}`);
}

/**
 * Convert ExcelJS worksheet row to financial transaction
 */
function worksheetRowToTransaction(row: ExcelJS.Row, rowIndex: number): FinancialTransaction | null {
  // ExcelJS uses sparse arrays - values start at index 1
  const values = row.values as (string | number | boolean | null | undefined)[];

  // Skip header row (rowIndex 1 in ExcelJS means first row)
  if (rowIndex === 1) {
    return null;
  }

  // Get cell values (1-indexed in ExcelJS, so values[1] is column A)
  const dateVal = values[1];
  const accountVal = values[2];
  const debitVal = values[3];
  const creditVal = values[4];
  const currencyVal = values[5];

  // Validate date - could be a number (Excel serial) or string (ISO)
  let date: string;
  if (dateVal === null || dateVal === undefined || dateVal === "") {
    throw new Error(`ingestion-date-invalid:${rowIndex}`);
  }

  if (typeof dateVal === "number") {
    date = excelSerialToDate(dateVal);
  } else if (typeof dateVal === "string") {
    // Validate ISO date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateVal.trim())) {
      throw new Error(`ingestion-date-invalid:${rowIndex}`);
    }
    date = dateVal.trim();
  } else {
    throw new Error(`ingestion-date-invalid:${rowIndex}`);
  }

  // Validate account
  const accountStr = String(accountVal ?? "").trim();
  if (!accountStr) {
    throw new Error(`ingestion-account-invalid:${rowIndex}`);
  }

  // Validate currency
  const currencyStr = String(currencyVal ?? "").trim();
  if (!currencyStr) {
    throw new Error(`ingestion-currency-invalid:${rowIndex}`);
  }

  // Parse amounts - debit/credit should be numbers or empty
  let debit: number;
  let credit: number;

  if (debitVal === null || debitVal === undefined || debitVal === "") {
    debit = 0;
  } else if (typeof debitVal === "number") {
    if (!Number.isFinite(debitVal) || debitVal < 0) {
      throw new Error(`ingestion-amount-invalid:debit:${rowIndex}`);
    }
    debit = debitVal;
  } else {
    throw new Error(`ingestion-amount-invalid:debit:${rowIndex}`);
  }

  if (creditVal === null || creditVal === undefined || creditVal === "") {
    credit = 0;
  } else if (typeof creditVal === "number") {
    if (!Number.isFinite(creditVal) || creditVal < 0) {
      throw new Error(`ingestion-amount-invalid:credit:${rowIndex}`);
    }
    credit = creditVal;
  } else {
    throw new Error(`ingestion-amount-invalid:credit:${rowIndex}`);
  }

  // Validate transaction rules
  if (debit === 0 && credit === 0) {
    throw new Error(`ingestion-zero-row:${rowIndex}`);
  }
  if (debit > 0 && credit > 0) {
    throw new Error(`ingestion-double-sided-row:${rowIndex}`);
  }

  return {
    date,
    account: accountStr,
    debit: Math.round((debit + Number.EPSILON) * 100) / 100,
    credit: Math.round((credit + Number.EPSILON) * 100) / 100,
    currency: currencyStr,
  };
}

/**
 * Canonical financial-data vertical slice.
 * File source -> CSV/JSON/Excel ingestion -> validation -> canonical normalization
 * -> tenant-scoped persistence -> independently calculated financial summary.
 */
export class FinancialDataIngestionAdapter {
  private readonly config: SpreadsheetIngestionConfig;

  constructor(
    private readonly persistence: SQLitePersistenceStore,
    config: Partial<SpreadsheetIngestionConfig> = {}
  ) {
    this.config = { ...DEFAULT_SPREADSHEET_CONFIG, ...config };
  }

  async ingestFile(tenantId: string, sourcePath: string): Promise<FinancialIngestionResult> {
    const normalizedPath = sourcePath.trim();
    if (!normalizedPath) throw new Error("ingestion-source-path-required");
    const sourceName = basename(normalizedPath);
    const ext = sourceName.toLowerCase().split('.').pop();

    if (ext === 'json') {
      const content = await readFile(normalizedPath, "utf8");
      return this.ingestStructured(tenantId, sourceName, content);
    }

    if (ext === 'txt') {
      return this.ingestTxt(tenantId, sourceName, normalizedPath);
    }

    if (ext === 'xlsx' || ext === 'xls') {
      // Read raw bytes for provenance
      const rawBytes = await readFile(normalizedPath);

      // Check file size limits
      if (ext === 'xls' && rawBytes.length > this.config.xlsMaxSizeBytes) {
        throw new Error("ingestion-file-too-large");
      }
      if (ext === 'xlsx' && rawBytes.length > this.config.xlsxMaxSizeBytes) {
        throw new Error("ingestion-file-too-large");
      }

      // Detect format from magic bytes
      const detectedFormat = detectFormatFromMagicBytes(rawBytes);
      if (!detectedFormat) {
        throw new Error("ingestion-format-unsupported");
      }

      // Validate extension matches detected format
      validateExtensionMatchesFormat(sourceName, detectedFormat);

      // Route to appropriate parser
      if (detectedFormat === "XLSX") {
        return this.ingestXlsx(tenantId, sourceName, rawBytes);
      }
      // XLS detection but wrong extension handled above
      throw new Error("ingestion-format-unsupported");
    }

    // For other extensions (csv, txt, etc.), do magic byte check first
    // If it looks like an Excel file but has wrong extension, reject it
    const rawBytes = await readFile(normalizedPath);
    const detectedFormat = detectFormatFromMagicBytes(rawBytes);
    if (detectedFormat === "XLS" || detectedFormat === "XLSX") {
      // Has Excel magic bytes but wrong extension - reject
      throw new Error("ingestion-format-unsupported");
    }

    // Default: CSV
    const content = await readFile(normalizedPath, "utf8");
    return this.ingestCsv(tenantId, sourceName, content);
  }

  /**
   * Ingest multiple files in a single batch operation.
   * Continues processing even if individual files fail (fail-fast: false).
   * Returns summary with per-file success/failure details.
   */
  async ingestBatch(tenantId: string, sourcePaths: ReadonlyArray<string>): Promise<BatchIngestionResult> {
    const normalizedTenant = tenantId.trim();
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");
    if (!sourcePaths || sourcePaths.length === 0) throw new Error("ingestion-batch-empty");

    const results: BatchIngestionItem[] = [];

    for (const sourcePath of sourcePaths) {
      try {
        const result = await this.ingestFile(normalizedTenant, sourcePath);
        results.push({
          sourcePath,
          success: true,
          evidence: result.evidence,
        });
      } catch (error) {
        results.push({
          sourcePath,
          success: false,
          error: error instanceof Error ? error.message : "ingestion-batch-item-unknown-error",
        });
      }
    }

    const successfulFiles = results.filter((r) => r.success).length;
    const failedFiles = results.filter((r) => !r.success).length;

    return {
      tenantId: normalizedTenant,
      totalFiles: sourcePaths.length,
      successfulFiles,
      failedFiles,
      results,
    };
  }

  async ingestCsv(tenantId: string, sourceName: string, csv: string): Promise<FinancialIngestionResult> {
    const normalizedTenant = tenantId.trim();
    const normalizedSource = sourceName.trim();
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");
    if (!normalizedSource) throw new Error("ingestion-source-required");
    if (!csv.trim()) throw new Error("ingestion-source-empty");

    const source: FinancialSourceEvidence = {
      sourceName: normalizedSource,
      sourceType: "CSV",
      sha256: createHash("sha256").update(csv, "utf8").digest("hex"),
      receivedAt: new Date().toISOString(),
    };

    const transactions = this.parseAndValidate(csv);
    const debit = this.round(transactions.reduce((sum, row) => sum + row.debit, 0));
    const credit = this.round(transactions.reduce((sum, row) => sum + row.credit, 0));

    const model: FinancialCanonicalModel = {
      tenantId: normalizedTenant,
      source,
      transactions,
      totals: { debit, credit, balance: this.round(debit - credit) },
    };

    await this.persistence.write({ tenantId: normalizedTenant }, `financial-ingestion:${source.sha256}`, model);
    return { evidence: source, model, persisted: true };
  }

  async ingestStructured(tenantId: string, sourceName: string, json: string): Promise<FinancialIngestionResult> {
    const normalizedTenant = tenantId.trim();
    const normalizedSource = sourceName.trim();
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");
    if (!normalizedSource) throw new Error("ingestion-source-required");
    if (!json.trim()) throw new Error("ingestion-source-empty");

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("ingestion-json-parse-error");
    }

    if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as Record<string, unknown>).transactions)) {
      throw new Error("ingestion-structured-schema-invalid");
    }

    const raw = parsed as {
      tenantId?: string;
      transactions: unknown[];
    };

    const sha256 = createHash("sha256").update(json, "utf8").digest("hex");
    const receivedAt = new Date().toISOString();

    const source: FinancialSourceEvidence = {
      sourceName: normalizedSource,
      sourceType: "STRUCTURED",
      sha256,
      receivedAt,
    };

    const transactions = this.validateStructuredTransactions(raw.transactions, json);
    const debit = this.round(transactions.reduce((sum, row) => sum + row.debit, 0));
    const credit = this.round(transactions.reduce((sum, row) => sum + row.credit, 0));

    const model: FinancialCanonicalModel = {
      tenantId: normalizedTenant,
      source,
      transactions,
      totals: { debit, credit, balance: this.round(debit - credit) },
    };

    await this.persistence.write({ tenantId: normalizedTenant }, `financial-ingestion:${source.sha256}`, model);
    return { evidence: source, model, persisted: true };
  }

  /**
   * Stage 08-DOC.1: TXT ingestion. Decodes the bytes via the TextFileDecoder
   * (UTF-8 / UTF-8 BOM / UTF-16 LE / UTF-16 BE) and reuses the canonical CSV
   * pipeline. The 5-column CSV schema check in `ingestCsv` enforces the
   * rejection rule — TXT files whose content does not match the canonical
   * ledger schema raise the same `ingestion-schema-invalid` error.
   */
  async ingestTxt(tenantId: string, sourceName: string, sourcePath: string): Promise<TxtIngestionResult> {
    const normalizedTenant = tenantId.trim();
    const normalizedSource = sourceName.trim();
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");
    if (!normalizedSource) throw new Error("ingestion-source-required");
    const rawBytes = await readFile(sourcePath);
    const decoded = decodeTextBytes(rawBytes);
    const result = await this.ingestCsv(normalizedTenant, normalizedSource, decoded.content);
    return { ...result, encoding: decoded.encoding };
  }

  /**
   * Ingest XLSX file using exceljs-hardened
   * Formula evaluation is disabled - only cell values are read
   */
  private async ingestXlsx(tenantId: string, sourceName: string, rawBytes: Buffer): Promise<FinancialIngestionResult> {
    const normalizedTenant = tenantId.trim();
    const normalizedSource = sourceName.trim();
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");
    if (!normalizedSource) throw new Error("ingestion-source-required");
    if (rawBytes.length === 0) throw new Error("ingestion-source-empty");

    const sha256 = createHash("sha256").update(rawBytes).digest("hex");
    const receivedAt = new Date().toISOString();

    const source: FinancialSourceEvidence = {
      sourceName: normalizedSource,
      sourceType: "XLSX",
      sha256,
      receivedAt,
    };

    // Parse with timeout and error handling
    let transactions: FinancialTransaction[];
    try {
      const parsePromise = this.parseXlsx(rawBytes);

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("ingestion-parse-timeout")), this.config.xlsParseBudgetMs);
      });

      transactions = await Promise.race([parsePromise, timeoutPromise]);
    } catch (error) {
      if (error instanceof Error) {
        // Let validation errors propagate with their original codes
        if (error.message.startsWith("ingestion-")) {
          throw error;
        }
        // Timeout error
        if (error.message === "ingestion-parse-timeout") {
          throw error;
        }
        // Zip parse errors (corrupted zip, etc.) - convert to excel parse error
        if (error.message.includes("Corrupted zip") ||
            error.message.includes("can't find end of central directory") ||
            error.message.includes("Invalid signature") ||
            error.message.includes("End of data reached")) {
          throw new Error("ingestion-excel-parse-error");
        }
      }
      // Unknown error - convert to excel parse error
      throw new Error("ingestion-excel-parse-error");
    }

    if (transactions.length === 0) {
      throw new Error("ingestion-empty-workbook");
    }

    const debit = this.round(transactions.reduce((sum, row) => sum + row.debit, 0));
    const credit = this.round(transactions.reduce((sum, row) => sum + row.credit, 0));

    const model: FinancialCanonicalModel = {
      tenantId: normalizedTenant,
      source,
      transactions,
      totals: { debit, credit, balance: this.round(debit - credit) },
    };

    await this.persistence.write({ tenantId: normalizedTenant }, `financial-ingestion:${source.sha256}`, model);
    return { evidence: source, model, persisted: true };
  }

  /**
   * Parse XLSX content using exceljs-hardened
   * Formulas are treated as untrusted input - only values are extracted
   */
  private async parseXlsx(rawBytes: Buffer): Promise<FinancialTransaction[]> {
    const workbook = new ExcelJS.Workbook();

    // Type assertion needed because Node.js Buffer and exceljs-hardened Buffer types differ
    const buffer = rawBytes as unknown as ArrayBuffer;

    // exceljs-hardened security features:
    // - CVE fix for decompression bombs (maxEntryUncompressedSize, maxTotalUncompressedSize)
    // - No formula evaluation by default - only cached values are read
    await workbook.xlsx.load(buffer, {
      // Security: Limit zip entry uncompressed size to 128MB (CWE-409)
      maxEntryUncompressedSize: this.config.xlsxZipEntryLimitBytes,
      // Security: Limit total uncompressed size to 512MB (CWE-409)
      maxTotalUncompressedSize: this.config.xlsxTotalUncompressedLimitBytes,
    });

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error("ingestion-empty-workbook");
    }

    // Validate header row first
    // ExcelJS uses sparse arrays - values start at index 1, index 0 is often undefined
    const firstRow = worksheet.getRow(1);
    const headerValues = (firstRow.values || []) as (string | number | boolean | null | undefined)[];

    // Filter out undefined/null values and get actual header values
    // Headers should be at indices 1-5 (date, account, debit, credit, currency)
    const headers: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const value = headerValues[i];
      headers.push(String(value ?? "").toLowerCase().trim());
    }

    const expected = ["date", "account", "debit", "credit", "currency"];

    if (headers.length !== expected.length || headers.some((value, index) => value !== expected[index])) {
      throw new Error("ingestion-schema-invalid");
    }

    const transactions: FinancialTransaction[] = [];

    worksheet.eachRow((row, rowIndex) => {
      // Skip header row
      if (rowIndex === 1) return;

      const txn = worksheetRowToTransaction(row, rowIndex);
      if (txn) {
        transactions.push(txn);
      }
    });

    if (transactions.length === 0) {
      throw new Error("ingestion-empty-workbook");
    }

    return transactions;
  }

  private parseAndValidate(csv: string): FinancialTransaction[] {
    const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error("ingestion-header-and-data-required");

    const header = this.parseLine(lines[0]).map((value) => value.toLowerCase());
    const expected = ["date", "account", "debit", "credit", "currency"];
    if (header.length !== expected.length || header.some((value, index) => value !== expected[index])) {
      throw new Error("ingestion-schema-invalid");
    }

    return lines.slice(1).map((line, index) => {
      const row = this.parseLine(line);
      if (row.length !== expected.length) throw new Error(`ingestion-row-invalid:${index + 2}`);
      const [date, account, debitText, creditText, currency] = row.map((value) => value.trim());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`ingestion-date-invalid:${index + 2}`);
      if (!account) throw new Error(`ingestion-account-invalid:${index + 2}`);
      if (!currency) throw new Error(`ingestion-currency-invalid:${index + 2}`);

      const debit = this.parseAmount(debitText, index + 2, "debit");
      const credit = this.parseAmount(creditText, index + 2, "credit");
      if (debit === 0 && credit === 0) throw new Error(`ingestion-zero-row:${index + 2}`);
      if (debit > 0 && credit > 0) throw new Error(`ingestion-double-sided-row:${index + 2}`);

      return { date, account, debit, credit, currency };
    });
  }

  private parseLine(line: string): string[] {
    const values: string[] = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') { current += '"'; i += 1; }
        else quoted = !quoted;
      } else if (char === "," && !quoted) {
        values.push(current); current = "";
      } else current += char;
    }
    if (quoted) throw new Error("ingestion-unterminated-quote");
    values.push(current);
    return values;
  }

  private parseAmount(value: string, row: number, field: string): number {
    if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error(`ingestion-amount-invalid:${field}:${row}`);
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) throw new Error(`ingestion-amount-invalid:${field}:${row}`);
    return this.round(amount);
  }

  private round(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }

  private validateStructuredTransactions(txns: unknown[], rawJson: string): FinancialTransaction[] {
    if (!Array.isArray(txns)) throw new Error("ingestion-structured-schema-invalid");

    return txns.map((txn, index) => {
      if (typeof txn !== "object" || txn === null) {
        throw new Error(`ingestion-structured-txn-invalid:${index}`);
      }
      const row = txn as Record<string, unknown>;
      const date = String(row.date ?? "");
      const account = String(row.account ?? "");
      const debit = typeof row.debit === "number" ? row.debit : 0;
      const credit = typeof row.credit === "number" ? row.credit : 0;
      const currency = String(row.currency ?? "");

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`ingestion-date-invalid:${index}`);
      if (!account) throw new Error(`ingestion-account-invalid:${index}`);
      if (!currency) throw new Error(`ingestion-currency-invalid:${index}`);
      if (debit === 0 && credit === 0) throw new Error(`ingestion-zero-row:${index}`);
      if (debit > 0 && credit > 0) throw new Error(`ingestion-double-sided-row:${index}`);
      if (!Number.isFinite(debit) || debit < 0) throw new Error(`ingestion-amount-invalid:debit:${index}`);
      if (!Number.isFinite(credit) || credit < 0) throw new Error(`ingestion-amount-invalid:credit:${index}`);

      return { date, account, debit: this.round(debit), credit: this.round(credit), currency };
    });
  }
}


