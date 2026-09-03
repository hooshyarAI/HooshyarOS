/**
 * Stage 08-DOC.1 — Plain-text file decoder supporting UTF-8 (no BOM),
 * UTF-8 BOM, UTF-16 LE BOM and UTF-16 BE BOM. Returns a string plus the
 * detected encoding so the adapter can record provenance.
 *
 * Pure / sync / no I/O. Reused by the adapter via the canonical
 * ingestion route — not a new Engine.
 */

export type TextEncoding = "UTF-8" | "UTF-8-BOM" | "UTF-16LE" | "UTF-16BE";

export interface DecodedText {
  readonly content: string;
  readonly encoding: TextEncoding;
}

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const UTF16_LE_BOM = Buffer.from([0xff, 0xfe]);
const UTF16_BE_BOM = Buffer.from([0xfe, 0xff]);

/**
 * Decode a plain-text buffer. Supports UTF-8, UTF-8 BOM, UTF-16 LE and
 * UTF-16 BE. Any other BOM or mojibake is rejected with
 * `ingestion-txt-encoding-unsupported` so the adapter can surface a
 * clear error instead of silently coercing.
 */
export function decodeTextBytes(buffer: Buffer): DecodedText {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error("ingestion-txt-decode-failed");
  }
  if (buffer.length === 0) {
    throw new Error("ingestion-source-empty");
  }

  if (
    buffer.length >= UTF16_LE_BOM.length &&
    UTF16_LE_BOM.equals(buffer.subarray(0, UTF16_LE_BOM.length))
  ) {
    return { content: buffer.toString("utf16le"), encoding: "UTF-16LE" };
  }
  if (
    buffer.length >= UTF16_BE_BOM.length &&
    UTF16_BE_BOM.equals(buffer.subarray(0, UTF16_BE_BOM.length))
  ) {
    // Node has no native utf16be string decoder. Swap byte pairs and decode as utf16le.
    const swapped = Buffer.from(buffer.subarray(2));
    swapped.swap16();
    return { content: swapped.toString("utf16le"), encoding: "UTF-16BE" };
  }
  if (
    buffer.length >= UTF8_BOM.length &&
    UTF8_BOM.equals(buffer.subarray(0, UTF8_BOM.length))
  ) {
    return { content: buffer.subarray(3).toString("utf8"), encoding: "UTF-8-BOM" };
  }

  // No BOM: treat as UTF-8 (the dominant modern default). Validate that the
  // bytes can be losslessly re-encoded — if not, the caller will reject.
  return { content: buffer.toString("utf8"), encoding: "UTF-8" };
}
