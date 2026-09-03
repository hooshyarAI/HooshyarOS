/**
 * Stage 08-DOC.2 — PDF Text-Native Acquisition (supporting service).
 *
 * Acquire .pdf files via `pdf-parse`: validate magic, extract text + metadata
 * for native-text PDFs, and signal scanned-only PDFs so a later OCR route can
 * pick them up. This module is NOT a new Engine. It is a pure helper used by
 * FinancialDataIngestionAdapter for the .pdf ingest route.
 *
 * Scanned-only detection: when the average characters-per-page is below a
 * conservative threshold, we throw `ingestion-pdf-scanned-no-ocr-yet` so the
 * adapter surface is honest and the OCR pipeline (08-IMG.2+) can take over.
 */
import { createHash } from "node:crypto";
import { PDFParse } from "pdf-parse";

export const PDF_ERROR_CODES = {
  EMPTY: "ingestion-pdf-empty",
  UNSUPPORTED: "ingestion-pdf-unsupported",
  MISMATCH: "ingestion-format-mismatch",
  PASSWORD: "ingestion-pdf-password-protected",
  CORRUPT: "ingestion-pdf-corrupt",
  SCANNED: "ingestion-pdf-scanned-no-ocr-yet",
} as const;

const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF

export interface PdfMetadata {
  readonly title?: string;
  readonly author?: string;
  readonly producer?: string;
  readonly creator?: string;
  readonly creationDate?: string;
  readonly modificationDate?: string;
}

export interface PdfTextPage {
  readonly pageNumber: number;
  readonly text: string;
  readonly charCount: number;
}

export interface PdfTextDocument {
  readonly sourceName: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly receivedAt: string;
  readonly pageCount: number;
  readonly text: string;
  readonly pages: ReadonlyArray<PdfTextPage>;
  readonly metadata: PdfMetadata;
  /** Average characters per page. Used to detect scanned-only PDFs. */
  readonly averageCharsPerPage: number;
}

export interface AcquirePdfOptions {
  readonly scannedThresholdCharsPerPage?: number;
  readonly receivedAt?: string;
}

export function detectPdfMagic(buffer: Buffer): boolean {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;
  return PDF_MAGIC.equals(buffer.subarray(0, 4));
}

function readMetaField(meta: Record<string, unknown> | undefined, key: string): string | undefined {
  if (!meta) return undefined;
  const value = meta[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readMetaDate(meta: Record<string, unknown> | undefined, key: string): string | undefined {
  if (!meta) return undefined;
  const value = meta[key];
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return undefined;
}

function isLikelyPasswordError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return m.includes("password") || m.includes("encrypted");
}

function isLikelyCorruptError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return m.includes("invalid pdf") || m.includes("corrupt") || m.includes("malformed") || m.includes("invalid signature");
}

/**
 * Acquire a PDF and extract native text. Throws ingestion-pdf-scanned-no-ocr-yet
 * if the document is effectively image-only. The OCR pipeline (08-IMG.2/08-IMG.3)
 * is responsible for converting scanned PDFs into text.
 */
export async function acquirePdf(params: {
  readonly sourceName: string;
  readonly rawBytes: Buffer;
  readonly options?: AcquirePdfOptions;
}): Promise<PdfTextDocument> {
  const { sourceName, rawBytes } = params;
  if (!Buffer.isBuffer(rawBytes) || rawBytes.length === 0) throw new Error(PDF_ERROR_CODES.EMPTY);
  if (!detectPdfMagic(rawBytes)) throw new Error(PDF_ERROR_CODES.UNSUPPORTED);
  const ext = sourceName.toLowerCase().split(".").pop() ?? "";
  if (ext !== "pdf") throw new Error(PDF_ERROR_CODES.MISMATCH);

  const sha256 = createHash("sha256").update(rawBytes).digest("hex");
  const receivedAt = params.options?.receivedAt ?? new Date().toISOString();
  const threshold = params.options?.scannedThresholdCharsPerPage ?? 50;

  const parser = new PDFParse({ data: new Uint8Array(rawBytes) });
  let info: { info?: unknown; metadata?: unknown } = {};
  let textPages: Array<{ num: number; text: string }> = [];
  try {
    const [infoResult, textResult] = await Promise.all([
      parser.getInfo().catch((e: unknown) => {
        if (isLikelyPasswordError(e)) throw new Error(PDF_ERROR_CODES.PASSWORD);
        if (isLikelyCorruptError(e)) throw new Error(PDF_ERROR_CODES.CORRUPT);
        return null;
      }),
      parser.getText().catch((e: unknown) => {
        if (isLikelyPasswordError(e)) throw new Error(PDF_ERROR_CODES.PASSWORD);
        if (isLikelyCorruptError(e)) throw new Error(PDF_ERROR_CODES.CORRUPT);
        return null;
      }),
    ]);
    if (infoResult) {
      info = { info: (infoResult as { info?: unknown }).info, metadata: (infoResult as { metadata?: unknown }).metadata };
    }
    if (textResult) {
      const pages = (textResult as { pages: Array<{ num: number; text: string }> }).pages;
      textPages = pages.map((p) => ({ num: p.num, text: p.text ?? "" }));
    }
  } finally {
    try { await parser.destroy(); } catch { /* best-effort */ }
  }

  const pageCount = textPages.length;
  const totalChars = textPages.reduce((sum, p) => sum + (p.text?.length ?? 0), 0);
  const averageCharsPerPage = pageCount > 0 ? totalChars / pageCount : 0;

  if (pageCount === 0 || averageCharsPerPage < threshold) {
    throw new Error(PDF_ERROR_CODES.SCANNED);
  }

  const pages: PdfTextPage[] = textPages.map((p) => ({ pageNumber: p.num, text: p.text, charCount: p.text.length }));
  const meta = (info.info ?? {}) as Record<string, unknown>;
  const metadata: PdfMetadata = {
    title: readMetaField(meta, "Title"),
    author: readMetaField(meta, "Author"),
    producer: readMetaField(meta, "Producer"),
    creator: readMetaField(meta, "Creator"),
    creationDate: readMetaDate(meta, "CreationDate"),
    modificationDate: readMetaDate(meta, "ModDate"),
  };

  return {
    sourceName: sourceName.trim(),
    sha256,
    byteLength: rawBytes.length,
    receivedAt,
    pageCount,
    text: pages.map((p) => p.text).join("\n\n"),
    pages,
    metadata,
    averageCharsPerPage,
  };
}