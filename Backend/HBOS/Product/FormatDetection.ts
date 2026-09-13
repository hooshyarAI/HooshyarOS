/**
 * Stage 08-F.2 — Format & Source Detection Module.
 *
 * Supporting service under the canonical FinancialDataIngestionAdapter.
 * This module is NOT a new Engine. It is a pure, side-effect-free helper
 * that classifies incoming file sources by three orthogonal signals:
 *
 *   1. magic bytes  (content-fingerprint from raw bytes)
 *   2. file extension (name-based hint)
 *   3. textual content sniff (JSON shape vs CSV row layout)
 *
 * The outputs feed `FinancialDataIngestionAdapter.ingestFile` so that the
 * canonical owner can route to the correct parser WITHOUT inventing a new
 * Engine per format. XLS is deliberately NOT included — it remains a
 * local dependency blocker (see 08-S.5) and is NOT supported here.
 *
 * Stability:
 *   - Pure functions, no I/O.
 *   - No `Date.now()` or randomness — deterministic for tests.
 *   - No new external dependencies.
 */

export type DetectedFormat = "CSV" | "STRUCTURED" | "XLSX";

export const FORMAT_DETECTION_ERROR_CODES = {
  UNSUPPORTED: "ingestion-format-unsupported",
  MISMATCH: "ingestion-format-mismatch",
} as const;

export type FormatDetectionErrorCode =
  (typeof FORMAT_DETECTION_ERROR_CODES)[keyof typeof FORMAT_DETECTION_ERROR_CODES];

export const MAGIC_TABLE = {
  XLSX_ZIP: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  XLS_OLE: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  PNG: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  JPEG: Buffer.from([0xff, 0xd8, 0xff]),
  PDF: Buffer.from([0x25, 0x50, 0x44, 0x46]),
} as const;

const XLSX_EXTENSIONS = new Set(["xlsx"]);
const CSV_EXTENSIONS = new Set(["csv"]);
const STRUCTURED_EXTENSIONS = new Set(["json"]);

export function detectFormatByMagic(buffer: Buffer): DetectedFormat | null {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return null;
  }
  if (
    buffer.length >= MAGIC_TABLE.XLSX_ZIP.length &&
    MAGIC_TABLE.XLSX_ZIP.equals(buffer.subarray(0, MAGIC_TABLE.XLSX_ZIP.length))
  ) {
    return "XLSX";
  }
  return null;
}

export function detectStructuredByContent(content: string): DetectedFormat | null {
  if (typeof content !== "string") return null;
  const trimmed = content.replace(/^\uFEFF/, "").trimStart();
  if (!trimmed) return null;
  const first = trimmed[0];
  if (first !== "{" && first !== "[") return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed === null) return null;
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return null;
      return parsed.every((el) => typeof el === "object" && el !== null)
        ? "STRUCTURED"
        : null;
    }
    if (typeof parsed === "object") return "STRUCTURED";
    return null;
  } catch {
    return null;
  }
}

export function detectFormatByExtension(name: string): DetectedFormat | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const ext = trimmed.toLowerCase().split(".").pop() ?? "";
  if (XLSX_EXTENSIONS.has(ext)) return "XLSX";
  if (CSV_EXTENSIONS.has(ext)) return "CSV";
  if (STRUCTURED_EXTENSIONS.has(ext)) return "STRUCTURED";
  return null;
}

export function classifySourceByContent(
  _bytes: Buffer,
  text?: string,
): DetectedFormat | null {
  if (typeof text === "string") {
    const structured = detectStructuredByContent(text);
    if (structured) return structured;
  }
  return null;
}

export interface DetectionResult {
  readonly format: DetectedFormat;
  readonly source: "magic" | "extension" | "content";
}

export function detectSourceFormat(params: {
  readonly sourceName: string;
  readonly rawBytes: Buffer;
  readonly textContent?: string;
}): DetectionResult & { readonly mismatch?: FormatDetectionErrorCode } {
  const magicFormat = detectFormatByMagic(params.rawBytes);
  const extensionFormat = detectFormatByExtension(params.sourceName);
  const contentFormat = classifySourceByContent(params.rawBytes, params.textContent);

  if (magicFormat) {
    if (extensionFormat && extensionFormat !== magicFormat) {
      return {
        format: magicFormat,
        source: "magic",
        mismatch: FORMAT_DETECTION_ERROR_CODES.MISMATCH,
      };
    }
    return { format: magicFormat, source: "magic" };
  }

  if (extensionFormat) {
    return { format: extensionFormat, source: "extension" };
  }

  if (contentFormat) {
    return { format: contentFormat, source: "content" };
  }

  throw new Error(FORMAT_DETECTION_ERROR_CODES.UNSUPPORTED);
}
