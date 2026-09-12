/**
 * Phase 14-1.1 / 14-1.2 — Commercial ingestion runtime composition service.
 *
 * This is a SUPPORTING SERVICE, not a new Engine and not an alternate adapter.
 * The canonical ingestion owner remains `FinancialDataIngestionAdapter`:
 * parsing, validation, normalization and persistence of the canonical model all
 * happen inside that owner. This service only:
 *
 *   1. dispatches a runtime-facing payload (CSV / STRUCTURED / XLSX / TXT) to
 *      the canonical adapter's public ingest methods;
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
} from "./FinancialDataIngestionAdapter";
import { decodeTextBytes } from "./TextFileDecoder";

export type IngestionFormat = "CSV" | "STRUCTURED" | "XLSX" | "TXT";

export const SUPPORTED_INGESTION_FORMATS: ReadonlyArray<IngestionFormat> = ["CSV", "STRUCTURED", "XLSX", "TXT"];

const RAW_SOURCE_PREFIX = "raw-source:";

export interface IngestionRequest {
  readonly sourceName: string;
  readonly format: IngestionFormat;
  /** Raw text content for CSV / STRUCTURED / TXT. */
  readonly content?: string;
  /** Base64-encoded bytes for XLSX. */
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

const isTextFormat = (format: IngestionFormat): boolean => format !== "XLSX";

export class FinancialIngestionService {
  private readonly adapter: FinancialDataIngestionAdapter;

  constructor(
    private readonly persistence: SQLitePersistenceStore,
    adapter?: FinancialDataIngestionAdapter,
  ) {
    this.adapter = adapter ?? new FinancialDataIngestionAdapter(persistence);
  }

  async ingest(tenantId: string, request: IngestionRequest): Promise<IngestionOutcome> {
    const normalizedTenant = tenantId?.trim() ?? "";
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");

    const sourceName = request.sourceName?.trim() ?? "";
    if (!sourceName) throw new Error("ingestion-source-required");

    const format = request.format;
    if (!SUPPORTED_INGESTION_FORMATS.includes(format)) {
      throw new Error("ingestion-format-unsupported");
    }

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
      default:
        throw new Error("ingestion-format-unsupported");
    }

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

  async listSources(tenantId: string): Promise<SourceSummary[]> {
    const normalizedTenant = tenantId?.trim() ?? "";
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");

    const rows = this.persistence.database
      .prepare("SELECT key, value_json FROM persistence_records WHERE tenant_id = ? AND key LIKE ? ORDER BY updated_at DESC")
      .all(normalizedTenant, `${RAW_SOURCE_PREFIX}%`) as Array<{ key: string; value_json: string }>;

    const summaries: SourceSummary[] = [];
    for (const row of rows) {
      const stored = this.parseStored(row.value_json);
      if (!stored) continue;
      summaries.push(this.toSummary(row.key, stored));
    }
    return summaries;
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
