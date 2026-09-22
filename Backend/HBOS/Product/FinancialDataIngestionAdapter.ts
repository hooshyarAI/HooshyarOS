import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import ExcelJS from "exceljs-hardened";
import { readXls } from "xls-reader";
import { SQLitePersistenceStore } from "./SQLitePersistenceStore";
import { decodeTextBytes } from "./TextFileDecoder";
import { acquireImage, type ImageSource } from "./ImageAcquisition";
import { acquirePdf, PDF_ERROR_CODES } from "./PdfAcquisition";
import { acquireDocx } from "./DocxAcquisition";
import {
  assertMarkupWithinLimits,
  extractMarkupTables,
  extractRepeatingXmlElements,
  htmlToText,
  xmlToText,
} from "./MarkupTextExtraction";
import {
  buildTableCandidate,
  detectOcrStatementTables,
  detectStatementTables,
  extractDeclaredCurrency,
  isCanonicalStatementHeader,
  mapStatementToCanonical,
  mapTableToCanonical,
  parseStatementAmount,
} from "./DocumentTableExtractor";
import {
  buildFinancialDocumentUnderstanding,
  FINANCIAL_DOCUMENT_ERROR_CODES,
  hasFinancialDocumentFacts,
  type FinancialDocumentUnderstanding,
} from "./FinancialDocumentUnderstanding";
import { createOcrProvenance, type OcrProvenance } from "./OcrProvenance";
import type { OcrAdapter, OcrResult } from "./OcrAdapter";
import { routeScannedPdfToOcr } from "./ScannedPdfRouter";
import type { IngestionProgressEvent, IngestionProgressObserver } from "./IngestionProgress";

export type TxtEncoding = "UTF-8" | "UTF-8-BOM" | "UTF-16LE" | "UTF-16BE";

export interface TxtIngestionResult extends FinancialIngestionResult {
  readonly encoding: TxtEncoding;
}

export type SourceType =
  | "CSV"
  | "STRUCTURED"
  | "XLS"
  | "XLSX"
  | "PDF"
  | "DOCX"
  | "HTML"
  | "XML"
  | "TSV"
  | "IMAGE";

export interface FinancialSourceEvidence {
  readonly sourceName: string;
  readonly sourceType: SourceType;
  readonly sha256: string;
  readonly receivedAt: string;
  /**
   * OCR provenance, present only when the canonical text was produced by an
   * explicitly supplied OCR provider. Absent for native text routes. Never
   * fabricated for a route that did not run OCR.
   */
  readonly ocr?: OcrProvenance;
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
  /**
   * Unified multi-section document understanding, present when the source was a
   * financial report / statement workbook rather than a single transaction
   * ledger. The 5-column transaction model remains canonical for real ledgers;
   * this optional view carries the extracted statement facts for reports whose
   * sections (balance sheet, income statement, cash flow, ...) are not ledgers.
   */
  readonly document?: FinancialDocumentUnderstanding;
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

/**
 * Explicit OCR route for scanned/image-only PDFs. Both the OCR adapter and the
 * page rasterizer are caller-supplied so the OCR engine and the rasterization
 * provider remain replaceable and are never a hidden mandatory dependency.
 */
export interface ScannedPdfOcrRoute {
  readonly ocr: OcrAdapter;
  readonly rasterizePage: (pageNumber: number) => Promise<Buffer>;
  readonly language?: string;
  readonly textNativeCharsPerPage?: number;
}

// ============================================================================
// Universal File Source Contract (Stage 08-F.1)
// Supporting contract under the existing FinancialDataIngestionAdapter.
// Defines the canonical pre-ingestion representation that all current and
// future acquisition routes (CSV, JSON/STRUCTURED, XLSX, and future TXT/PDF/
// image/API/DB sources) can share. Legacy XLS is handled by the governed
// `ingestXlsBytes` route (see `document.xls.parse` in the provider registry)
// and is intentionally not part of this pre-ingestion FileSource union, which
// remains the minimal shared representation for the internal-text routes.
// ============================================================================

/**
 * File source types represented by the universal FileSource contract.
 * Legacy XLS is admitted through `ingestXlsBytes` (governed `xls-reader`
 * provider) rather than this internal-text union; the richer XLS acquisition
 * evidence lives on the canonical `FinancialSourceEvidence` instead.
 */
export type FileSourceType = "CSV" | "STRUCTURED" | "XLSX" | "IMAGE";

/**
 * IANA-style media type identifiers for the supported file sources.
 * Extensible: future TXT/PDF/IMAGE/API/DB routes will add their own values
 * without breaking existing consumers.
 */
export type FileSourceMediaType =
  | "text/csv"
  | "application/json"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  | "image/png"
  | "image/jpeg";

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

    if (ext === 'tsv') {
      const content = await readFile(normalizedPath, "utf8");
      return this.ingestTsv(tenantId, sourceName, content);
    }

    if (ext === 'html' || ext === 'htm') {
      const content = await readFile(normalizedPath, "utf8");
      return this.ingestHtml(tenantId, sourceName, content);
    }

    if (ext === 'xml') {
      const content = await readFile(normalizedPath, "utf8");
      return this.ingestXml(tenantId, sourceName, content);
    }

    if (ext === 'docx' || ext === 'doc') {
      const docxBytes = await readFile(normalizedPath);
      return this.ingestDocxBytes(tenantId, sourceName, docxBytes);
    }

    if (ext === 'pdf') {
      const pdfBytes = await readFile(normalizedPath);
      return this.ingestPdfBytes(tenantId, sourceName, pdfBytes);
    }

    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
      // Validate via the raw-image acquisition contract, then signal that
      // OCR is required to produce transactions. This preserves the
      // canonical ingestFile signature without inventing a fake model.
      const imgRaw = await readFile(normalizedPath);
      acquireImage({ sourceName, rawBytes: imgRaw });
      throw new Error("ingestion-image-requires-ocr");
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
      // Legacy OLE2 BIFF workbook: governed `xls-reader` route.
      return this.ingestXlsBytes(tenantId, sourceName, rawBytes);
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
   * Stage 08-IMG.1: Raw image acquisition. Validates magic bytes,
   * size and extension for .png/.jpeg and returns an ImageSource
   * describing the validated file. NO OCR is performed here —
   * OCR is the job of stage 08-IMG.2/08-IMG.3.
   */
  async ingestImage(sourcePath: string): Promise<ImageSource> {
    const normalizedPath = sourcePath.trim();
    if (!normalizedPath) throw new Error("ingestion-source-path-required");
    const sourceName = require("node:path").basename(normalizedPath);
    const rawBytes = await readFile(normalizedPath);
    return acquireImage({ sourceName, rawBytes });
  }

  /**
   * Stage 08-DOC.1: TXT ingestion. Decodes the bytes via the TextFileDecoder
   * (UTF-8 / UTF-8 BOM / UTF-16 LE / UTF-16 BE) and reuses the canonical CSV
   * pipeline. The 5-column CSV schema check in `ingestCsv` enforces the
   * rejection rule — TXT files whose content does not match the canonical
   * ledger schema raise the same `ingestion-schema-invalid` error.
   */
  async ingestTxt(tenantId: string, sourceName: string, sourcePath: string): Promise<TxtIngestionResult> {
    const rawBytes = await readFile(sourcePath);
    return this.ingestTxtBytes(tenantId, sourceName, rawBytes);
  }

  /**
   * Stage 14-1.1: byte-based TXT ingestion. Same decoding and canonical CSV
   * pipeline as `ingestTxt`, but accepts the raw bytes directly so the
   * commercial runtime can ingest uploads without touching the filesystem.
   */
  async ingestTxtBytes(tenantId: string, sourceName: string, rawBytes: Buffer): Promise<TxtIngestionResult> {
    const normalizedTenant = tenantId.trim();
    const normalizedSource = sourceName.trim();
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");
    if (!normalizedSource) throw new Error("ingestion-source-required");
    const decoded = decodeTextBytes(rawBytes);
    const result = await this.ingestCsv(normalizedTenant, normalizedSource, decoded.content);
    return { ...result, encoding: decoded.encoding };
  }

  /**
   * Stage 08-DOC.2 / PDF capability: byte-based text-native PDF ingestion.
   *
   * Reuses the existing `acquirePdf` helper (single `pdf-parse` dependency) to
   * validate the `%PDF` magic, extract deterministic text and reject
   * scanned/unextractable PDFs. The extracted text is then normalized through
   * the same canonical CSV/ledger pipeline as every other text route, so no
   * alternate financial model and no second adapter are introduced.
   *
   * Provenance: the canonical model's `source.sha256` is the SHA-256 of the
   * ORIGINAL PDF bytes (not the extracted text), so the original-byte identity
   * survives into `financial-ingestion:<sha256>` and downstream analysis.
   */
  async ingestPdfBytes(
    tenantId: string,
    sourceName: string,
    rawBytes: Buffer,
    observer?: IngestionProgressObserver,
  ): Promise<FinancialIngestionResult> {
    const normalizedTenant = tenantId.trim();
    const normalizedSource = sourceName.trim();
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");
    if (!normalizedSource) throw new Error("ingestion-source-required");
    if (rawBytes.length === 0) throw new Error("ingestion-source-empty");

    observer?.({ stage: "DOCUMENT_DETECTION" });
    const document = await acquirePdf({ sourceName: normalizedSource, rawBytes });

    const source: FinancialSourceEvidence = {
      sourceName: normalizedSource,
      sourceType: "PDF",
      sha256: document.sha256,
      receivedAt: document.receivedAt,
    };

    observer?.({ stage: "NORMALIZING" });
    const paged = document.pages.length > 0
      ? this.buildPagedLines(document.pages.map((page) => ({ pageNumber: page.pageNumber, text: page.text })))
      : { text: document.text, pageNumbers: undefined as number[] | undefined };
    const normalized = this.normalizeFinancialReportText(paged.text, observer, paged.pageNumbers);
    return this.finalize(normalizedTenant, source, normalized.transactions, normalized.document);
  }

  /**
   * Multi-format canonical route: DOCX. The `mammoth` provider (already a
   * declared dependency) extracts raw text and, when it can, the real document
   * tables. Extracted tables are mapped through the canonical table contract
   * (`DocumentTableExtractor.mapTableToCanonical`); otherwise the text is
   * normalized through the same canonical ledger pipeline as every text route.
   * Provenance stays anchored to the ORIGINAL DOCX-byte SHA-256.
   */
  async ingestDocxBytes(
    tenantId: string,
    sourceName: string,
    rawBytes: Buffer,
  ): Promise<FinancialIngestionResult> {
    const normalizedTenant = tenantId.trim();
    const normalizedSource = sourceName.trim();
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");
    if (!normalizedSource) throw new Error("ingestion-source-required");
    if (!Buffer.isBuffer(rawBytes) || rawBytes.length === 0) throw new Error("ingestion-source-empty");

    const document = await acquireDocx({ sourceName: normalizedSource, rawBytes });
    const source: FinancialSourceEvidence = {
      sourceName: normalizedSource,
      sourceType: "DOCX",
      sha256: document.sha256,
      receivedAt: document.receivedAt,
    };

    const fromTables = this.mapMarkupTablesToTransactions(document.tables);
    const transactions = fromTables ?? this.parseAndValidate(document.text);
    return this.finalize(normalizedTenant, source, transactions);
  }

  /**
   * Multi-format canonical route: HTML. Table structure is preserved through
   * the canonical table contract when a recognizable ledger table exists;
   * otherwise bounded visible text is extracted (active content discarded) and
   * normalized through the canonical ledger pipeline.
   */
  async ingestHtml(tenantId: string, sourceName: string, html: string): Promise<FinancialIngestionResult> {
    const normalizedTenant = tenantId.trim();
    const normalizedSource = sourceName.trim();
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");
    if (!normalizedSource) throw new Error("ingestion-source-required");
    assertMarkupWithinLimits(html);

    const source: FinancialSourceEvidence = {
      sourceName: normalizedSource,
      sourceType: "HTML",
      sha256: createHash("sha256").update(html, "utf8").digest("hex"),
      receivedAt: new Date().toISOString(),
    };

    const fromTables = this.mapMarkupTablesToTransactions(
      extractMarkupTables(html).map((table) => table.rows),
    );
    if (fromTables) return this.finalize(normalizedTenant, source, fromTables);

    const text = htmlToText(html);
    if (!text.trim()) throw new Error("ingestion-html-empty");
    const transactions = this.parseAndValidate(text);
    return this.finalize(normalizedTenant, source, transactions);
  }

  /**
   * Multi-format canonical route: XML. Unsafe XML (DTD/ENTITY) is rejected
   * before any processing (XXE / entity-expansion defense). A repeating
   * `<transaction>` element contract is mapped through the canonical table
   * contract when present; otherwise bounded visible text is normalized through
   * the canonical ledger pipeline.
   */
  async ingestXml(tenantId: string, sourceName: string, xml: string): Promise<FinancialIngestionResult> {
    const normalizedTenant = tenantId.trim();
    const normalizedSource = sourceName.trim();
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");
    if (!normalizedSource) throw new Error("ingestion-source-required");
    assertMarkupWithinLimits(xml);

    const source: FinancialSourceEvidence = {
      sourceName: normalizedSource,
      sourceType: "XML",
      sha256: createHash("sha256").update(xml, "utf8").digest("hex"),
      receivedAt: new Date().toISOString(),
    };

    const records = extractRepeatingXmlElements(xml, "transaction");
    if (records.length > 0) {
      const rows: string[][] = [
        ["date", "account", "debit", "credit", "currency"],
        ...records.map((record) => [
          record.date ?? "",
          record.account ?? "",
          record.debit ?? "",
          record.credit ?? "",
          record.currency ?? "",
        ]),
      ];
      const fromElements = this.mapMarkupTablesToTransactions([rows]);
      if (fromElements) return this.finalize(normalizedTenant, source, fromElements);
    }

    const text = xmlToText(xml);
    if (!text.trim()) throw new Error("ingestion-xml-empty");
    const transactions = this.parseAndValidate(text);
    return this.finalize(normalizedTenant, source, transactions);
  }

  /**
   * Multi-format canonical route: TSV. Tab-delimited ledgers converge on the
   * SAME canonical validation/normalization pipeline as CSV (only the cell
   * delimiter differs), so no parallel spreadsheet/text architecture exists.
   */
  async ingestTsv(tenantId: string, sourceName: string, tsv: string): Promise<FinancialIngestionResult> {
    const normalizedTenant = tenantId.trim();
    const normalizedSource = sourceName.trim();
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");
    if (!normalizedSource) throw new Error("ingestion-source-required");
    if (!tsv.trim()) throw new Error("ingestion-source-empty");

    const source: FinancialSourceEvidence = {
      sourceName: normalizedSource,
      sourceType: "TSV",
      sha256: createHash("sha256").update(tsv, "utf8").digest("hex"),
      receivedAt: new Date().toISOString(),
    };

    const transactions = this.parseAndValidate(tsv, "\t");
    return this.finalize(normalizedTenant, source, transactions);
  }

  /**
   * Governed scanned/image-only PDF OCR route (supporting path). The caller
   * supplies the OCR adapter and page rasterizer explicitly, so no OCR engine
   * becomes a hidden mandatory dependency of the text-native route.
   * `FinancialIngestionService` assembles this route from the admitted
   * `document.pdf.ocr` provider (`Product/OcrAdapter.createCanonicalOcrAdapter`)
   * and the admitted `document.pdf.rasterize` rasterizer; when no OCR provider
   * is admitted the text-native route keeps failing closed with
   * `ingestion-pdf-scanned-no-ocr-yet`.
   *
   * Provenance: the canonical model still uses the ORIGINAL PDF-byte SHA-256,
   * and the OCR engine identity/version/confidence/language is recorded on the
   * evidence so OCR-derived text is distinguishable from native text.
   */
  async ingestScannedPdfBytes(
    tenantId: string,
    sourceName: string,
    rawBytes: Buffer,
    route: ScannedPdfOcrRoute,
    observer?: IngestionProgressObserver,
  ): Promise<FinancialIngestionResult> {
    const normalizedTenant = tenantId.trim();
    const normalizedSource = sourceName.trim();
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");
    if (!normalizedSource) throw new Error("ingestion-source-required");
    if (!Buffer.isBuffer(rawBytes) || rawBytes.length === 0) throw new Error("ingestion-source-empty");

    const document = await acquirePdf({
      sourceName: normalizedSource,
      rawBytes,
      options: {
        allowScanned: true,
        scannedThresholdCharsPerPage: route.textNativeCharsPerPage,
      },
    });
    if (document.pages.length === 0) throw new Error(PDF_ERROR_CODES.SCANNED);

    const routed = await routeScannedPdfToOcr(document, route.ocr, {
      rasterizePage: route.rasterizePage,
      textNativeCharsPerPage: route.textNativeCharsPerPage,
      language: route.language,
      onPageProgress: (info) => observer?.({ stage: "OCR", page: info.done, pages: info.total, percent: info.percent }),
    });

    const ocrByPage = new Map<number, OcrResult>();
    let index = 0;
    for (const decision of routed.decisions) {
      if (!decision.needsOcr) continue;
      const result = routed.ocrResults[index];
      index += 1;
      if (result) ocrByPage.set(decision.pageNumber, result);
    }

    const paged = this.buildPagedLines(
      document.pages.map((page) => ({
        pageNumber: page.pageNumber,
        text: ocrByPage.get(page.pageNumber)?.text ?? page.text,
      })),
    );
    const text = paged.text;
    if (!text.trim()) throw new Error("ingestion-ocr-empty");

    observer?.({ stage: "NORMALIZING" });
    const normalized = this.normalizeFinancialReportText(text, observer, paged.pageNumbers);
    const source: FinancialSourceEvidence = {
      sourceName: normalizedSource,
      sourceType: "PDF",
      sha256: document.sha256,
      receivedAt: document.receivedAt,
      ...(routed.ocrResults.length > 0
        ? { ocr: this.buildOcrProvenance(route.ocr, routed.ocrResults, route.language) }
        : {}),
    };
    observer?.({ stage: "PERSISTING" });
    return this.finalize(normalizedTenant, source, normalized.transactions, normalized.document);
  }

  /**
   * Governed image OCR route (supporting path). Requires an explicitly supplied
   * OCR adapter; fails closed when OCR text cannot be recognized. Provenance is
   * the ORIGINAL image-byte SHA-256 with OCR engine metadata recorded.
   */
  async ingestImageBytes(
    tenantId: string,
    sourceName: string,
    rawBytes: Buffer,
    ocr: OcrAdapter,
    language?: string,
    observer?: IngestionProgressObserver,
  ): Promise<FinancialIngestionResult> {
    const normalizedTenant = tenantId.trim();
    const normalizedSource = sourceName.trim();
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");
    if (!normalizedSource) throw new Error("ingestion-source-required");

    const image = acquireImage({ sourceName: normalizedSource, rawBytes });
    observer?.({ stage: "OCR" });
    const recognized = await ocr.recognize({ sourceName: image.sourceName, rawBytes, language });
    if (!recognized.text.trim()) throw new Error("ingestion-ocr-empty");

    observer?.({ stage: "NORMALIZING" });
    const normalized = this.normalizeFinancialReportText(recognized.text, observer);
    const source: FinancialSourceEvidence = {
      sourceName: normalizedSource,
      sourceType: "IMAGE",
      sha256: image.sha256,
      receivedAt: image.receivedAt,
      ocr: this.buildOcrProvenance(ocr, [recognized], language),
    };
    return this.finalize(normalizedTenant, source, normalized.transactions, normalized.document);
  }

  /**
   * Ingest XLSX bytes using exceljs-hardened
   * Formula evaluation is disabled - only cell values are read.
   * Stage 14-1.1: made public so the commercial runtime can ingest uploaded
   * bytes through the canonical owner without writing untrusted data to disk.
   */
  async ingestXlsx(
    tenantId: string,
    sourceName: string,
    rawBytes: Buffer,
    observer?: IngestionProgressObserver,
  ): Promise<FinancialIngestionResult> {
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

    observer?.({ stage: "DOCUMENT_DETECTION" });
    const workbook = await this.loadXlsxWorkbook(rawBytes);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) throw new Error("ingestion-empty-workbook");

    const headerValues = this.readLedgerHeaderCells(worksheet);

    // The real 5-column transaction ledger keeps its exact existing behavior.
    if (this.isLedgerHeader(headerValues)) {
      const transactions = this.extractXlsxLedgerTransactions(worksheet);
      if (transactions.length === 0) throw new Error("ingestion-empty-workbook");
      observer?.({ stage: "EVIDENCE_VALIDATION" });
      return this.finalize(normalizedTenant, source, transactions);
    }

    // A genuinely intended-but-malformed ledger still fails precisely.
    if (this.looksLikeLedgerHeader(headerValues)) throw new Error("ingestion-schema-invalid");

    // Otherwise the workbook is treated as a financial-statement workbook and
    // routed through the SAME unified boundary as PDF reports.
    const grids = workbook.worksheets.map((sheet) => ({
      name: sheet.name,
      rows: this.xlsxWorksheetGrid(sheet),
    }));
    const document = this.buildSpreadsheetDocument(grids, observer);
    observer?.({ stage: "EVIDENCE_VALIDATION" });
    if (hasFinancialDocumentFacts(document) || document.status !== "FAILED") {
      return this.finalize(normalizedTenant, source, [], document);
    }
    throw new Error(FINANCIAL_DOCUMENT_ERROR_CODES.SPREADSHEET_STATEMENT_AMBIGUOUS);
  }

  /**
   * Legacy binary .xls (OLE2 / BIFF8) route through the admitted, governed
   * `xls-reader` provider. Values only are read (no macro or formula executes);
   * input identity, size and tenant isolation stay canonical, and the resulting
   * workbook converges on the same unified statement/ledger boundary as XLSX.
   */
  async ingestXlsBytes(
    tenantId: string,
    sourceName: string,
    rawBytes: Buffer,
    observer?: IngestionProgressObserver,
  ): Promise<FinancialIngestionResult> {
    const normalizedTenant = tenantId.trim();
    const normalizedSource = sourceName.trim();
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");
    if (!normalizedSource) throw new Error("ingestion-source-required");
    if (!Buffer.isBuffer(rawBytes) || rawBytes.length === 0) throw new Error("ingestion-source-empty");
    if (rawBytes.length > this.config.xlsMaxSizeBytes) throw new Error("ingestion-file-too-large");
    if (!detectFormatFromMagicBytes(rawBytes)) throw new Error("ingestion-format-unsupported");
    if (detectFormatFromMagicBytes(rawBytes) !== "XLS") throw new Error("ingestion-format-mismatch");

    const sha256 = createHash("sha256").update(rawBytes).digest("hex");
    const receivedAt = new Date().toISOString();
    const source: FinancialSourceEvidence = {
      sourceName: normalizedSource,
      sourceType: "XLS",
      sha256,
      receivedAt,
    };

    observer?.({ stage: "DOCUMENT_DETECTION" });
    let workbook: ReturnType<typeof readXls>;
    try {
      workbook = readXls(new Uint8Array(rawBytes));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/encrypt|password|FilePass|RC4|XOR/i.test(message)) throw new Error("xls-encrypted-unsupported");
      throw new Error("xls-malformed");
    }
    if (!workbook.sheets || workbook.sheets.length === 0) throw new Error("xls-malformed");

    const grids = workbook.sheets.map((sheet) => ({
      name: sheet.name,
      rows: sheet.rows.map((row) => row.map((cell) => this.spreadsheetCellToString(cell))),
    }));
    const first = grids[0];
    if (!first) throw new Error("ingestion-empty-workbook");

    if (this.isLedgerHeader(first.rows[0] ?? [])) {
      const transactions = this.gridToLedgerTransactions(first.rows);
      observer?.({ stage: "EVIDENCE_VALIDATION" });
      return this.finalize(normalizedTenant, source, transactions);
    }
    if (this.looksLikeLedgerHeader(first.rows[0] ?? [])) throw new Error("ingestion-schema-invalid");

    const document = this.buildSpreadsheetDocument(grids, observer);
    observer?.({ stage: "EVIDENCE_VALIDATION" });
    if (hasFinancialDocumentFacts(document) || document.status !== "FAILED") {
      return this.finalize(normalizedTenant, source, [], document);
    }
    throw new Error(FINANCIAL_DOCUMENT_ERROR_CODES.SPREADSHEET_STATEMENT_AMBIGUOUS);
  }

  /**
   * Load an XLSX workbook with the hardened resource limits and a parse-time
   * budget. No formula is evaluated; only cached cell values are read.
   */
  private async loadXlsxWorkbook(rawBytes: Buffer): Promise<ExcelJS.Workbook> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = (async (): Promise<ExcelJS.Workbook> => {
      const workbook = new ExcelJS.Workbook();
      const buffer = rawBytes as unknown as ArrayBuffer;
      await workbook.xlsx.load(buffer, {
        maxEntryUncompressedSize: this.config.xlsxZipEntryLimitBytes,
        maxTotalUncompressedSize: this.config.xlsxTotalUncompressedLimitBytes,
      });
      return workbook;
    })();
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("ingestion-parse-timeout")), this.config.xlsParseBudgetMs);
    });
    try {
      return await Promise.race([load, timeout]);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "ingestion-parse-timeout") throw error;
        if (error.message.startsWith("ingestion-")) throw error;
        if (error.message.includes("Corrupted zip") ||
            error.message.includes("can't find end of central directory") ||
            error.message.includes("Invalid signature") ||
            error.message.includes("End of data reached")) {
          throw new Error("ingestion-excel-parse-error");
        }
      }
      throw new Error("ingestion-excel-parse-error");
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Read the first five header cells of a worksheet exactly as the ledger contract expects. */
  private readLedgerHeaderCells(worksheet: ExcelJS.Worksheet): string[] {
    const firstRow = worksheet.getRow(1);
    const headerValues = (firstRow.values || []) as (string | number | boolean | null | undefined)[];
    const headers: string[] = [];
    for (let i = 1; i <= 5; i += 1) {
      headers.push(String(headerValues[i] ?? "").toLowerCase().trim());
    }
    return headers;
  }

  /** Canonical 5-column ledger extraction (unchanged semantics). */
  private extractXlsxLedgerTransactions(worksheet: ExcelJS.Worksheet): FinancialTransaction[] {
    const transactions: FinancialTransaction[] = [];
    worksheet.eachRow((row, rowIndex) => {
      if (rowIndex === 1) return;
      const txn = worksheetRowToTransaction(row, rowIndex);
      if (txn) transactions.push(txn);
    });
    return transactions;
  }

  /** Convert a worksheet into a bounded rectangular grid of text cells. */
  private xlsxWorksheetGrid(worksheet: ExcelJS.Worksheet): string[][] {
    const columnCount = Math.min(Math.max(worksheet.columnCount, 0), 64);
    const rows: string[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = (row.values || []) as unknown[];
      const cells: string[] = [];
      for (let c = 1; c <= columnCount; c += 1) {
        cells.push(this.spreadsheetCellToString(values[c]));
      }
      rows.push(cells);
    });
    return rows;
  }

  private parseAndValidate(csv: string, delimiter = ","): FinancialTransaction[] {
    const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error("ingestion-header-and-data-required");

    const header = this.parseLine(lines[0], delimiter).map((value) => value.toLowerCase());
    const expected = ["date", "account", "debit", "credit", "currency"];
    if (header.length !== expected.length || header.some((value, index) => value !== expected[index])) {
      throw new Error("ingestion-schema-invalid");
    }

    return lines.slice(1).map((line, index) => {
      const row = this.parseLine(line, delimiter);
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

  private parseLine(line: string, delimiter = ","): string[] {
    const values: string[] = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') { current += '"'; i += 1; }
        else quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        values.push(current); current = "";
      } else current += char;
    }
    if (quoted) throw new Error("ingestion-unterminated-quote");
    values.push(current);
    return values;
  }

  /**
   * Canonical normalization for OCR-extracted document text.
   *
   * Real scanned financial statements do not match the synthetic 5-column
   * ledger CSV. This routes the extracted text through the canonical
   * document-table boundary (`DocumentTableExtractor`) FIRST: every detected
   * statement table whose header declares the canonical fields is mapped with
   * the document's declared currency. The strict CSV contract is used only as
   * a fallback for text that genuinely matches it (e.g. a rendered ledger line
   * that OCR recovered verbatim), so real-world OCR output is never forced
   * through the synthetic schema.
   *
   * Fail-closed: if a canonical statement header was detected but no row could
   * be mapped safely, the precise typed table error is rethrown instead of
   * degrading to the less precise `ingestion-schema-invalid`.
   */
  private normalizeExtractedDocument(text: string): FinancialTransaction[] {
    const declaredCurrency = extractDeclaredCurrency(text) ?? undefined;
    const candidates = [...detectStatementTables(text), ...detectOcrStatementTables(text)];
    let headerMatched = false;
    let firstError: Error | null = null;

    for (const candidate of candidates) {
      if (!isCanonicalStatementHeader(candidate.headers)) continue;
      headerMatched = true;
      try {
        const mapped = mapStatementToCanonical(candidate, { defaultCurrency: declaredCurrency });
        if (mapped.length > 0) {
          return mapped.map((row) => ({
            date: row.date,
            account: row.account,
            debit: row.debit,
            credit: row.credit,
            currency: row.currency,
          }));
        }
      } catch (error) {
        if (!firstError) firstError = error instanceof Error ? error : new Error(String(error));
      }
    }

    if (headerMatched) throw firstError ?? new Error("ingestion-table-schema-invalid");
    return this.parseAndValidate(text);
  }

  /**
   * Unified normalization for extracted document text (text-native PDF, scanned
   * PDF OCR, image OCR).
   *
   * The canonical ledger/statement transaction route is tried first so a real
   * ledger or ledger-like statement is unchanged. When that route cannot map the
   * text and the document is a multi-section financial report, the SAME unified
   * `FinancialDocumentUnderstanding` boundary used by XLSX/XLS produces the
   * canonical statement facts, so a full annual report no longer fails merely
   * because it is not a single transaction ledger. Fail closed: if neither route
   * yields evidence, the precise original error is preserved.
   */
  private normalizeFinancialReportText(
    text: string,
    observer?: IngestionProgressObserver,
    pageNumbers?: ReadonlyArray<number>,
  ): { readonly transactions: FinancialTransaction[]; readonly document?: FinancialDocumentUnderstanding } {
    let transactions: FinancialTransaction[] | null = null;
    let transactionError: Error | null = null;
    try {
      transactions = this.normalizeExtractedDocument(text);
    } catch (error) {
      transactionError = error instanceof Error ? error : new Error(String(error));
    }
    if (transactions && transactions.length > 0) {
      observer?.({ stage: "CANONICAL_VALIDATION" });
      return { transactions };
    }

    const document = buildFinancialDocumentUnderstanding([
      {
        rows: text.split(/\r?\n/).map((line) => [line.replace(/\u00a0/g, " ").trimEnd()]),
        ...(pageNumbers ? { pageNumbers } : {}),
      },
    ]);
    this.emitDocumentStages(document, observer);
    observer?.({ stage: "EVIDENCE_VALIDATION" });

    if (hasFinancialDocumentFacts(document) || document.status !== "FAILED") {
      return { transactions: [], document };
    }
    throw transactionError ?? new Error(FINANCIAL_DOCUMENT_ERROR_CODES.INSUFFICIENT_EVIDENCE);
  }

  /**
   * Reconstruct the canonical document text from paged text while keeping a
   * parallel, index-aligned page-number array so section page ranges come from
   * real evidence. Page separation matches `acquirePdf` (pages joined by "\n\n").
   */
  private buildPagedLines(
    pages: ReadonlyArray<{ readonly pageNumber: number; readonly text: string }>,
  ): { readonly text: string; readonly pageNumbers: number[] } {
    const lines: string[] = [];
    const pageNumbers: number[] = [];
    pages.forEach((page, index) => {
      if (index > 0) {
        lines.push("");
        pageNumbers.push(page.pageNumber);
      }
      for (const line of String(page.text ?? "").split(/\r?\n/)) {
        lines.push(line);
        pageNumbers.push(page.pageNumber);
      }
    });
    return { text: lines.join("\n"), pageNumbers };
  }

  /**
   * Emit the real section stages the unified boundary actually detected. Only
   * sections that exist in the evidence produce an event; nothing is faked.
   */
  private emitDocumentStages(document: FinancialDocumentUnderstanding, observer?: IngestionProgressObserver): void {
    if (!observer || document.sections.length === 0) return;
    const stageByType: Record<string, string> = {
      AUDITOR_REPORT: "SECTION_AUDITOR_REPORT",
      BOARD_REPORT: "SECTION_BOARD_REPORT",
      BALANCE_SHEET: "SECTION_BALANCE_SHEET",
      INCOME_STATEMENT: "SECTION_INCOME_STATEMENT",
      CASH_FLOW_STATEMENT: "SECTION_CASH_FLOW",
      CHANGES_IN_EQUITY: "SECTION_EQUITY",
      NOTES: "SECTION_NOTES",
    };
    const emitted = new Set<string>();
    for (const section of document.sections) {
      const stage = stageByType[section.type];
      if (!stage || emitted.has(stage)) continue;
      emitted.add(stage);
      observer({ stage: stage as IngestionProgressEvent["stage"], code: section.type });
    }
  }

  /** Convert spreadsheet cells/rows into plain trimmed text cells. */
  private spreadsheetCellToString(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : "";
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      // ExcelJS formula cell: read the cached RESULT only, never evaluate.
      if ("result" in record) return this.spreadsheetCellToString(record.result);
      if ("error" in record) return "";
      if (Array.isArray(record.richText)) {
        return (record.richText as Array<{ text?: unknown }>).map((part) => String(part?.text ?? "")).join("").trim();
      }
      if (typeof record.text === "string") return record.text.trim();
      if (typeof record.hyperlink === "string" && typeof record.text === "string") return record.text.trim();
      return "";
    }
    return String(value).trim();
  }

  /**
   * Canonical spreadsheet statement route shared by XLSX and legacy XLS. It
   * builds the unified document understanding from worksheet name + rows, so a
   * financial-statement workbook (multiple sheets, Persian labels, units and
   * comparative periods) reaches the same canonical facts as a PDF report.
   */
  private buildSpreadsheetDocument(
    sheets: ReadonlyArray<{ readonly name: string; readonly rows: ReadonlyArray<ReadonlyArray<string>> }>,
    observer?: IngestionProgressObserver,
  ): FinancialDocumentUnderstanding {
    observer?.({ stage: "DOCUMENT_DETECTION" });
    const document = buildFinancialDocumentUnderstanding(
      sheets.map((sheet) => ({ name: sheet.name, rows: sheet.rows, positioned: true })),
    );
    observer?.({ stage: "SECTION_DETECTION" });
    this.emitDocumentStages(document, observer);
    return document;
  }

  /**
   * Ledger-intent detection for a worksheet grid: the header declares at least
   * three canonical ledger fields. Used to keep the precise
   * `ingestion-schema-invalid` error for a genuinely intended-but-malformed
   * ledger instead of the less specific spreadsheet-statement error.
   */
  private looksLikeLedgerHeader(header: ReadonlyArray<string>): boolean {
    const normalized = header.map((cell) => String(cell ?? "").trim().toLowerCase());
    const canonical = ["date", "account", "debit", "credit", "currency"];
    const matched = canonical.filter((field) => normalized.includes(field)).length;
    return matched >= 3;
  }

  private isLedgerHeader(header: ReadonlyArray<string>): boolean {
    const normalized = header.map((cell) => String(cell ?? "").trim().toLowerCase());
    const canonical = ["date", "account", "debit", "credit", "currency"];
    return normalized.length >= canonical.length && canonical.every((field, index) => normalized[index] === field);
  }

  /**
   * Parse an already-decoded ledger grid (used by the legacy XLS route, where
   * cell values are plain strings) into canonical transactions, failing closed
   * with the same precise codes as the CSV/XLSX ledger routes.
   */
  private gridToLedgerTransactions(rows: ReadonlyArray<ReadonlyArray<string>>): FinancialTransaction[] {
    if (rows.length < 2) throw new Error("ingestion-header-and-data-required");
    const header = rows[0].map((cell) => String(cell ?? "").trim().toLowerCase());
    if (!this.isLedgerHeader(header)) throw new Error("ingestion-schema-invalid");

    const transactions: FinancialTransaction[] = [];
    for (let r = 1; r < rows.length; r += 1) {
      const row = rows[r].map((cell) => String(cell ?? "").trim());
      const rowNumber = r + 1;
      const [date, account, debitText, creditText, currency] = row;
      if (!date || !account || !currency) throw new Error(`ingestion-row-invalid:${rowNumber}`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`ingestion-date-invalid:${rowNumber}`);
      const debit = debitText ? parseStatementAmount(debitText) : 0;
      const credit = creditText ? parseStatementAmount(creditText) : 0;
      if (debit === null || debit < 0) throw new Error(`ingestion-amount-invalid:debit:${rowNumber}`);
      if (credit === null || credit < 0) throw new Error(`ingestion-amount-invalid:credit:${rowNumber}`);
      if (debit === 0 && credit === 0) throw new Error(`ingestion-zero-row:${rowNumber}`);
      if (debit > 0 && credit > 0) throw new Error(`ingestion-double-sided-row:${rowNumber}`);
      transactions.push({ date, account, debit: this.round(debit), credit: this.round(credit), currency });
    }
    if (transactions.length === 0) throw new Error("ingestion-empty-workbook");
    return transactions;
  }

  /**
   * Map already-extracted document tables to canonical transactions using the
   * single canonical table contract. Returns null when no table matches the
   * canonical ledger schema, so the caller can fall back to text extraction
   * instead of fabricating rows. Never partially maps an ambiguous table.
   */
  private mapMarkupTablesToTransactions(
    tables: ReadonlyArray<ReadonlyArray<ReadonlyArray<string>>>,
  ): FinancialTransaction[] | null {
    for (const rows of tables) {
      const candidate = buildTableCandidate(rows);
      if (!candidate) continue;
      try {
        const mapped = mapTableToCanonical(candidate);
        if (mapped.length > 0) {
          return mapped.map((row) => ({
            date: row.date,
            account: row.account,
            debit: row.debit,
            credit: row.credit,
            currency: row.currency,
          }));
        }
      } catch {
        // Ambiguous/invalid candidate: try the next table, never guess.
      }
    }
    return null;
  }

  /**
   * Build truthful OCR provenance from real OCR results. Confidence is null
   * when no word confidences were produced (unknown), never a fabricated 0.
   */
  private buildOcrProvenance(
    ocr: OcrAdapter,
    results: ReadonlyArray<OcrResult>,
    language?: string,
  ): OcrProvenance {
    const words = results.flatMap((result) => result.words);
    const confidence = words.length > 0
      ? words.reduce((sum, word) => sum + word.confidence, 0) / words.length
      : null;
    return createOcrProvenance({
      engine: results[0]?.engine ?? ocr.engine,
      engineVersion: results[0]?.engineVersion ?? "unknown",
      confidence,
      language: language ?? results[0]?.language ?? "unknown",
    });
  }

  /** Compute canonical totals and persist a tenant-scoped canonical model. */
  private async finalize(
    tenantId: string,
    source: FinancialSourceEvidence,
    transactions: FinancialTransaction[],
    document?: FinancialDocumentUnderstanding,
  ): Promise<FinancialIngestionResult> {
    const debit = this.round(transactions.reduce((sum, row) => sum + row.debit, 0));
    const credit = this.round(transactions.reduce((sum, row) => sum + row.credit, 0));
    const model: FinancialCanonicalModel = {
      tenantId,
      source,
      transactions,
      totals: { debit, credit, balance: this.round(debit - credit) },
      ...(document ? { document } : {}),
    };
    await this.persistence.write({ tenantId }, `financial-ingestion:${source.sha256}`, model);
    return { evidence: source, model, persisted: true };
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


