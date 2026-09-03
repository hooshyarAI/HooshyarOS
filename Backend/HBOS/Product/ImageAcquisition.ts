/**
 * Stage 08-IMG.1 — Raw Image Acquisition (supporting service).
 *
 * Acquire .png and .jpg/.jpeg files: validate magic bytes, compute
 * SHA-256, declare a structured ImageSource and (caller-side) persist
 * the raw bytes via the canonical RawSourceRef contract.
 *
 * This module is NOT a new Engine. It is a pure, side-effect-free
 * classifier that the canonical FinancialDataIngestionAdapter can
 * reuse when its ingestFile routes a `.png`/`.jpg`/`.jpeg` file.
 *
 * OCR is NOT performed here — that is the explicit job of stage
 * 08-IMG.2 / 08-IMG.3.
 */

export type ImageFormat = "PNG" | "JPEG";

export interface ImageSource {
  readonly sourceName: string;
  readonly format: ImageFormat;
  readonly mediaType: "image/png" | "image/jpeg";
  readonly sha256: string;
  readonly byteLength: number;
  readonly receivedAt: string;
}

export const IMAGE_ERROR_CODES = {
  EMPTY: "ingestion-image-empty",
  TOO_LARGE: "ingestion-image-too-large",
  UNSUPPORTED: "ingestion-image-unsupported",
  MISMATCH: "ingestion-image-mismatch",
} as const;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

/**
 * Detect image format from magic bytes. Returns `null` when the bytes
 * do not match PNG or JPEG. Future formats (TIFF, HEIC, etc.) can be
 * added as additional cases.
 */
export function detectImageFormat(buffer: Buffer): ImageFormat | null {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  if (buffer.length >= PNG_MAGIC.length && PNG_MAGIC.equals(buffer.subarray(0, PNG_MAGIC.length))) {
    return "PNG";
  }
  if (buffer.length >= JPEG_MAGIC.length && JPEG_MAGIC.equals(buffer.subarray(0, JPEG_MAGIC.length))) {
    return "JPEG";
  }
  return null;
}

export function detectImageFormatByExtension(name: string): ImageFormat | null {
  if (typeof name !== "string") return null;
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "PNG";
  if (ext === "jpg" || ext === "jpeg") return "JPEG";
  return null;
}

export interface AcquireImageOptions {
  /** Maximum byte length allowed. Default 10 MB per stage spec. */
  readonly maxBytes?: number;
}

/**
 * Acquire a raw image. Validates size, magic bytes, and extension.
 * Returns an ImageSource describing the validated image. Throws with
 * a code from IMAGE_ERROR_CODES on failure. Never performs OCR.
 */
export function acquireImage(params: {
  readonly sourceName: string;
  readonly rawBytes: Buffer;
  readonly receivedAt?: string;
  readonly options?: AcquireImageOptions;
}): ImageSource {
  const maxBytes = params.options?.maxBytes ?? 10 * 1024 * 1024;
  if (!Buffer.isBuffer(params.rawBytes) || params.rawBytes.length === 0) {
    throw new Error(IMAGE_ERROR_CODES.EMPTY);
  }
  if (params.rawBytes.length > maxBytes) {
    throw new Error(IMAGE_ERROR_CODES.TOO_LARGE);
  }

  const magic = detectImageFormat(params.rawBytes);
  if (!magic) {
    throw new Error(IMAGE_ERROR_CODES.UNSUPPORTED);
  }

  const ext = detectImageFormatByExtension(params.sourceName);
  if (!ext) {
    throw new Error(IMAGE_ERROR_CODES.MISMATCH);
  }
  if (ext !== magic) {
    throw new Error(IMAGE_ERROR_CODES.MISMATCH);
  }

  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  const sha256 = createHash("sha256").update(params.rawBytes).digest("hex");

  return {
    sourceName: params.sourceName.trim(),
    format: magic,
    mediaType: magic === "PNG" ? "image/png" : "image/jpeg",
    sha256,
    byteLength: params.rawBytes.length,
    receivedAt: params.receivedAt ?? new Date().toISOString(),
  };
}
