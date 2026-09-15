/**
 * Stage 08-DOC.3 — DOCX + DOC Acquisition (supporting service).
 *
 * Acquire .docx files via `mammoth.extractRawText` for plain-text output.
 * DOC (.doc) is the legacy binary Word format and is NOT supported here
 * because it requires the `antiword` native binary or similar; the adapter
 * surfaces a clear `ingestion-doc-not-supported` error instead of pretending
 * to extract text. The .doc -> .docx conversion is a tenant responsibility.
 *
 * This module is NOT a new Engine. It is a pure helper used by
 * FinancialDataIngestionAdapter for the .docx ingest route.
 */
import { createHash } from "node:crypto";
import mammoth from "mammoth";

export const DOCX_ERROR_CODES = {
  EMPTY: "ingestion-docx-empty",
  UNSUPPORTED: "ingestion-docx-unsupported",
  MISMATCH: "ingestion-format-mismatch",
  PARSE: "ingestion-docx-parse-error",
  DOC_NOT_SUPPORTED: "ingestion-doc-not-supported",
} as const;

const DOCX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // ZIP signature

export interface DocxExtraction {
  readonly sourceName: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly receivedAt: string;
  readonly text: string;
  readonly messages: ReadonlyArray<string>;
}

export function detectDocxMagic(buffer: Buffer): boolean {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;
  return DOCX_MAGIC.equals(buffer.subarray(0, 4));
}

export function detectDocFormatByExtension(name: string): "DOCX" | "DOC" | null {
  if (typeof name !== "string") return null;
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "docx") return "DOCX";
  if (ext === "doc") return "DOC";
  return null;
}

/**
 * Acquire a .docx file: validates magic + extension, runs
 * `mammoth.extractRawText`, returns a `DocxExtraction`.
 */
export async function acquireDocx(params: {
  readonly sourceName: string;
  readonly rawBytes: Buffer;
  readonly receivedAt?: string;
}): Promise<DocxExtraction> {
  const { sourceName, rawBytes } = params;
  if (!Buffer.isBuffer(rawBytes) || rawBytes.length === 0) {
    throw new Error(DOCX_ERROR_CODES.EMPTY);
  }
  const fmt = detectDocFormatByExtension(sourceName);
  if (fmt === "DOC") {
    throw new Error(DOCX_ERROR_CODES.DOC_NOT_SUPPORTED);
  }
  if (fmt !== "DOCX") {
    throw new Error(DOCX_ERROR_CODES.MISMATCH);
  }
  if (!detectDocxMagic(rawBytes)) {
    throw new Error(DOCX_ERROR_CODES.UNSUPPORTED);
  }

  const sha256 = createHash("sha256").update(rawBytes).digest("hex");
  const receivedAt = params.receivedAt ?? new Date().toISOString();

  let text = "";
  const messages: string[] = [];
  try {
    const result = await mammoth.extractRawText({ buffer: rawBytes });
    text = result.value ?? "";
    for (const msg of result.messages ?? []) {
      messages.push(String((msg as { message?: unknown }).message ?? ""));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    throw new Error(`${DOCX_ERROR_CODES.PARSE}:${msg}`);
  }

  return {
    sourceName: sourceName.trim(),
    sha256,
    byteLength: rawBytes.length,
    receivedAt,
    text,
    messages,
  };
}