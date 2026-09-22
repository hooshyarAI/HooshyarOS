/**
 * Phase 14-1.1 / 14-1.2 — Commercial ingestion runtime composition service.
 *
 * This is a SUPPORTING SERVICE, not a new Engine and not an alternate adapter.
 * The canonical ingestion owner remains `FinancialDataIngestionAdapter`:
 * parsing, validation, normalization and persistence of the canonical model all
 * happen inside that owner. This service only:
 *
 *   1. dispatches a runtime-facing payload (CSV / STRUCTURED / XLSX / TXT / PDF)
 *      to the canonical adapter's public ingest methods;
 *   2. persists the tenant-scoped RAW SOURCE EVIDENCE bytes under
 *      `raw-source:<sha256>` through the canonical SQLitePersistenceStore, so
 *      provenance survives independently of the normalized model;
 *   3. lists and reads that raw evidence strictly within the caller's tenant.
 *
 * No ingestion semantics are reimplemented here.
 */
import { SQLitePersistenceStore } from "./SQLitePersistenceStore";
import {
  FinancialDataIngestionAdapter,
  FinancialIngestionResult,
  SourceType,
  computeSourceSha256,
  type RawSourceRef,
  type ScannedPdfOcrRoute,
} from "./FinancialDataIngestionAdapter";
import { decodeTextBytes } from "./TextFileDecoder";
import {
  CapabilityProviderRegistry,
  type CapabilityCategory,
} from "./CapabilityProviderRegistry";
import { createCanonicalOcrAdapter, type OcrAdapter } from "./OcrAdapter";
import { createPdfPageRasterizer } from "./PdfPageRasterizer";
import { PDF_ERROR_CODES } from "./PdfAcquisition";
import type { IngestionProgressObserver } from "./IngestionProgress";

export type IngestionFormat =
  | "CSV"
  | "STRUCTURED"
  | "XLSX"
  | "TXT"
  | "TSV"
  | "HTML"
  | "XML"
  | "DOCX"
  | "PDF";

export const SUPPORTED_INGESTION_FORMATS: ReadonlyArray<IngestionFormat> = [
  "CSV",
  "STRUCTURED",
  "XLSX",
  "TXT",
  "TSV",
  "HTML",
  "XML",
  "DOCX",
  "PDF",
];

const RAW_SOURCE_PREFIX = "raw-source:";

/**
 * Capability Provider Leverage: external capabilities each runtime format
 * depends on. Internal-only formats (CSV / STRUCTURED / TXT / TSV / HTML / XML)
 * are implemented by the canonical owner itself through internal capabilities
 * and are therefore not gated by an external provider admission.
 */
const EXTERNAL_PROVIDER_CATEGORY: Partial<Record<IngestionFormat, CapabilityCategory>> = {
  XLSX: "spreadsheet.xlsx.parse",
  DOCX: "document.docx.text",
  PDF: "document.pdf.text",
};

export interface IngestionRequest {
  readonly sourceName: string;
  readonly format: IngestionFormat;
  /** Raw text content for CSV / STRUCTURED / TXT. */
  readonly content?: string;
  /** Base64-encoded bytes for binary formats (XLSX / PDF). */
  readonly contentBase64?: string;
}

export interface IngestionOutcome {
  readonly tenantId: string;
  readonly requestedFormat: IngestionFormat;
  readonly result: FinancialIngestionResult;
  readonly rawSourceRef: RawSourceRef;
  readonly encoding?: string;
}

export interface SourceSummary {
  readonly persistenceKey: string;
  readonly sha256: string;
  readonly sourceName: string;
  readonly format: IngestionFormat;
  readonly sourceType: SourceType;
  readonly byteLength: number;
  readonly receivedAt: string;
}

export interface RawSourceEvidence extends SourceSummary {
  readonly tenantId: string;
  readonly contentEncoding: "utf8" | "base64";
  readonly content: string;
}

interface StoredRawSource {
  readonly sourceName: string;
  readonly format: IngestionFormat;
  readonly sourceType: SourceType;
  readonly sha256: string;
  readonly byteLength: number;
  readonly receivedAt: string;
  readonly contentEncoding: "utf8" | "base64";
  readonly content: string;
}

const isTextFormat = (format: IngestionFormat): boolean =>
  format !== "XLSX" && format !== "PDF" && format !== "DOCX";

/**
 * A resolved scanned-PDF OCR route plus its cleanup hook. The route is
 * assembled from the admitted OCR provider (`document.pdf.ocr`) and the
 * admitted rasterizer (`document.pdf.rasterize`); `null` means the capability
 * is not admitted, in which case the original precise no-OCR limitation is
 * preserved (nothing is faked).
 */
export interface ScannedPdfOcrRouteHandle {
  readonly route: ScannedPdfOcrRoute;
  dispose(): Promise<void>;
}

export type ScannedPdfOcrRouteFactory = (rawBytes: Buffer) => ScannedPdfOcrRouteHandle | null;

/** Default OCR language set for the commercial ingestion path. */
export const DEFAULT_OCR_LANGUAGE = "fas+eng";

export class FinancialIngestionService {
  private readonly adapter: FinancialDataIngestionAdapter;

  constructor(
    private readonly persistence: SQLitePersistenceStore,
    adapter?: FinancialDataIngestionAdapter,
    private readonly providers: CapabilityProviderRegistry = new CapabilityProviderRegistry(),
    private readonly scannedPdfOcrRoute?: ScannedPdfOcrRouteFactory,
  ) {
    this.adapter = adapter ?? new FinancialDataIngestionAdapter(persistence);
  }

  async ingest(tenantId: string, request: IngestionRequest, observer?: IngestionProgressObserver): Promise<IngestionOutcome> {
    observer?.({ stage: "VALIDATING" });
    const normalizedTenant = tenantId?.trim() ?? "";
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");

    const sourceName = request.sourceName?.trim() ?? "";
    if (!sourceName) throw new Error("ingestion-source-required");

    const format = request.format;
    if (!SUPPORTED_INGESTION_FORMATS.includes(format)) {
      throw new Error("ingestion-format-unsupported");
    }

    this.assertProviderAdmitted(format);

    const bytes = this.decodeRequestBytes(request);
    const sha256 = computeSourceSha256(bytes);

    let result: FinancialIngestionResult;
    let encoding: string | undefined;
    switch (format) {
      case "CSV":
        result = await this.adapter.ingestCsv(normalizedTenant, sourceName, request.content ?? "");
        break;
      case "STRUCTURED":
        result = await this.adapter.ingestStructured(normalizedTenant, sourceName, request.content ?? "");
        break;
      case "XLSX":
        result = await this.adapter.ingestXlsx(normalizedTenant, sourceName, bytes);
        break;
      case "TXT": {
        const txtResult = await this.adapter.ingestTxtBytes(normalizedTenant, sourceName, bytes);
        encoding = txtResult.encoding;
        result = txtResult;
        break;
      }
      case "TSV":
        result = await this.adapter.ingestTsv(normalizedTenant, sourceName, request.content ?? "");
        break;
      case "HTML":
        result = await this.adapter.ingestHtml(normalizedTenant, sourceName, request.content ?? "");
        break;
      case "XML":
        result = await this.adapter.ingestXml(normalizedTenant, sourceName, request.content ?? "");
        break;
      case "DOCX":
        result = await this.adapter.ingestDocxBytes(normalizedTenant, sourceName, bytes);
        break;
      case "PDF":
        result = await this.ingestPdfDocument(normalizedTenant, sourceName, bytes, observer);
        break;
      default:
        throw new Error("ingestion-format-unsupported");
    }

    observer?.({ stage: "PERSISTING" });
    const rawSourceRef = await this.persistRawSource(normalizedTenant, {
      sourceName,
      format,
      sourceType: result.evidence.sourceType,
      sha256,
      byteLength: bytes.length,
      receivedAt: result.evidence.receivedAt,
      contentEncoding: isTextFormat(format) ? "utf8" : "base64",
      content: isTextFormat(format) ? bytes.toString("utf8") : bytes.toString("base64"),
    });

    return { tenantId: normalizedTenant, requestedFormat: format, result, rawSourceRef, encoding };
  }

  /**
   * Capability Provider Leverage enforcement (fail closed): a runtime format
   * backed by an external provider must resolve to an admitted, integrated
   * provider through the canonical registry. The default registry admits the
   * seeded providers (pdf-parse, exceljs-hardened), so existing behaviour is
   * unchanged; a withdrawn or unadmitted provider is refused instead of being
   * used silently.
   */
  private assertProviderAdmitted(format: IngestionFormat): void {
    const category = EXTERNAL_PROVIDER_CATEGORY[format];
    if (!category) return;
    try {
      this.providers.selectProvider(category);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown";
      throw new Error(`ingestion-provider-not-admitted:${detail}`);
    }
  }

  /**
   * Canonical PDF ingestion. Text-native PDFs take the accepted route
   * unchanged. A scanned/image-only PDF is routed to OCR only when the OCR
   * capability is admitted and a route can be assembled; otherwise the precise
   * `ingestion-pdf-scanned-no-ocr-yet` limitation is preserved (never faked).
   */
  private async ingestPdfDocument(
    tenantId: string,
    sourceName: string,
    bytes: Buffer,
    observer?: IngestionProgressObserver,
  ): Promise<FinancialIngestionResult> {
    observer?.({ stage: "READING_PDF" });
    try {
      return await this.adapter.ingestPdfBytes(tenantId, sourceName, bytes);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes(PDF_ERROR_CODES.SCANNED)) throw error;

      observer?.({ stage: "SCANNED_DETECTED" });
      const factory = this.scannedPdfOcrRoute ?? ((raw: Buffer) => this.createDefaultScannedPdfOcrRoute(raw));
      const handle = factory(bytes);
      if (!handle) throw error;

      try {
        return await this.adapter.ingestScannedPdfBytes(tenantId, sourceName, bytes, handle.route, observer);
      } finally {
        await handle.dispose();
      }
    }
  }

  /**
   * Assemble the scanned-PDF OCR route from the canonical provider registry.
   * Returns `null` when `document.pdf.ocr` is not admitted, so scanned PDFs
   * keep failing closed with the documented limitation instead of attempting a
   * provider that has not passed admission.
   */
  private createDefaultScannedPdfOcrRoute(rawBytes: Buffer): ScannedPdfOcrRouteHandle | null {
    try {
      this.providers.selectProvider("document.pdf.ocr");
    } catch {
      return null;
    }
    const ocr: OcrAdapter = createCanonicalOcrAdapter({ language: DEFAULT_OCR_LANGUAGE });
    const rasterizer = createPdfPageRasterizer({ rawBytes });
    return {
      route: {
        ocr,
        rasterizePage: (pageNumber: number) => rasterizer.rasterizePage(pageNumber),
        language: DEFAULT_OCR_LANGUAGE,
      },
      dispose: () => rasterizer.destroy(),
    };
  }

  async listSources(tenantId: string): Promise<SourceSummary[]> {
    return (await this.listSourcesPage(tenantId, Number.MAX_SAFE_INTEGER, 0)).items;
  }

  /**
   * Bounded page over the tenant's raw source evidence.
   *
   * Ordering is `updated_at DESC, persistence key ASC`, which is a total order
   * (the key is unique per tenant), so paginating an unchanged dataset can
   * neither duplicate nor skip a record. The tenant filter is applied in SQL
   * before the slice, so cross-tenant evidence can never appear.
   */
  async listSourcesPage(tenantId: string, limit: number, offset: number): Promise<{ readonly items: SourceSummary[]; readonly total: number }> {
    const normalizedTenant = tenantId?.trim() ?? "";
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");

    const rows = this.persistence.database
      .prepare("SELECT key, value_json FROM persistence_records WHERE tenant_id = ? AND key LIKE ? ORDER BY updated_at DESC, key ASC")
      .all(normalizedTenant, `${RAW_SOURCE_PREFIX}%`) as Array<{ key: string; value_json: string }>;

    const summaries: SourceSummary[] = [];
    for (const row of rows) {
      const stored = this.parseStored(row.value_json);
      if (!stored) continue;
      summaries.push(this.toSummary(row.key, stored));
    }

    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : summaries.length;
    const safeOffset = Number.isInteger(offset) && offset > 0 ? offset : 0;
    return { items: summaries.slice(safeOffset, safeOffset + safeLimit), total: summaries.length };
  }

  async readSource(tenantId: string, sha256: string): Promise<RawSourceEvidence | null> {
    const normalizedTenant = tenantId?.trim() ?? "";
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");
    const normalizedSha = sha256?.trim().toLowerCase() ?? "";
    if (!/^[0-9a-f]{64}$/.test(normalizedSha)) return null;

    const record = await this.persistence.read({ tenantId: normalizedTenant }, `${RAW_SOURCE_PREFIX}${normalizedSha}`);
    if (!record) return null;
    const stored = this.parseStoredValue(record.value);
    if (!stored) return null;
    return { ...this.toSummary(record.key, stored), tenantId: normalizedTenant, contentEncoding: stored.contentEncoding, content: stored.content };
  }

  private decodeRequestBytes(request: IngestionRequest): Buffer {
    if (isTextFormat(request.format)) {
      const content = request.content;
      if (typeof content !== "string" || !content.trim()) throw new Error("ingestion-source-empty");
      return Buffer.from(content, "utf8");
    }
    const base64 = request.contentBase64;
    if (typeof base64 !== "string" || !base64.trim()) throw new Error("ingestion-source-empty");
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length === 0) throw new Error("ingestion-source-empty");
    return bytes;
  }

  private async persistRawSource(tenantId: string, stored: StoredRawSource): Promise<RawSourceRef> {
    await this.persistence.write({ tenantId }, `${RAW_SOURCE_PREFIX}${stored.sha256}`, stored);
    return { persistenceKey: `${RAW_SOURCE_PREFIX}${stored.sha256}`, sha256: stored.sha256, byteLength: stored.byteLength, persisted: true };
  }

  private parseStored(valueJson: string): StoredRawSource | null {
    try {
      return this.parseStoredValue(JSON.parse(valueJson) as unknown);
    } catch {
      return null;
    }
  }

  private parseStoredValue(value: unknown): StoredRawSource | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const candidate = value as Partial<StoredRawSource>;
    if (
      typeof candidate.sourceName !== "string" ||
      typeof candidate.sha256 !== "string" ||
      typeof candidate.byteLength !== "number" ||
      typeof candidate.receivedAt !== "string" ||
      typeof candidate.content !== "string" ||
      (candidate.contentEncoding !== "utf8" && candidate.contentEncoding !== "base64")
    ) {
      return null;
    }
    return candidate as StoredRawSource;
  }

  private toSummary(key: string, stored: StoredRawSource): SourceSummary {
    return {
      persistenceKey: key,
      sha256: stored.sha256,
      sourceName: stored.sourceName,
      format: stored.format,
      sourceType: stored.sourceType,
      byteLength: stored.byteLength,
      receivedAt: stored.receivedAt,
    };
  }
}

/** Exported for tests and callers that need the canonical decoding primitive. */
export { decodeTextBytes };
