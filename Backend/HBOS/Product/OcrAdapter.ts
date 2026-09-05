/**
 * Stage 08-IMG.2 — OCR Acquisition Adapter.
 *
 * Supporting service under the canonical FinancialDataIngestionAdapter.
 * Defines the OcrAdapter contract and a TesseractOcrAdapter reference
 * implementation backed by `tesseract.js`. The adapter exposes
 * recognizeImage(source) -> OcrResult, returning the extracted text plus
 * per-word confidences. This module is NOT a new Engine.
 */
import { createHash } from "node:crypto";
import Tesseract from "tesseract.js";

export const OCR_ERROR_CODES = {
  EMPTY: "ingestion-ocr-empty",
  UNSUPPORTED: "ingestion-ocr-unsupported",
  RECOGNIZE_FAILED: "ingestion-ocr-recognize-failed",
} as const;

export interface OcrWord {
  readonly text: string;
  readonly confidence: number;
}

export interface OcrResult {
  readonly sourceName: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly receivedAt: string;
  readonly text: string;
  readonly meanConfidence: number;
  readonly words: ReadonlyArray<OcrWord>;
  readonly engine: string;
  readonly engineVersion: string;
  readonly language: string;
}

export interface OcrAdapter {
  readonly engine: string;
  recognize(params: {
    readonly sourceName: string;
    readonly rawBytes: Buffer;
    readonly language?: string;
    readonly receivedAt?: string;
  }): Promise<OcrResult>;
}

export interface TesseractOcrAdapterOptions {
  /** Tesseract language pack to load. Default: "eng". */
  readonly language?: string;
  /** Optional logger override (for tests). */
  readonly logger?: unknown;
}

export class TesseractOcrAdapter implements OcrAdapter {
  readonly engine = "tesseract.js";
  private readonly language: string;
  private readonly logger: unknown;

  constructor(options: TesseractOcrAdapterOptions = {}) {
    this.language = options.language ?? "eng";
    this.logger = options.logger;
  }

  async recognize(params: {
    readonly sourceName: string;
    readonly rawBytes: Buffer;
    readonly language?: string;
    readonly receivedAt?: string;
  }): Promise<OcrResult> {
    if (!Buffer.isBuffer(params.rawBytes) || params.rawBytes.length === 0) {
      throw new Error(OCR_ERROR_CODES.EMPTY);
    }
    const language = params.language ?? this.language;
    const sha256 = createHash("sha256").update(params.rawBytes).digest("hex");
    const receivedAt = params.receivedAt ?? new Date().toISOString();

    let result: Awaited<ReturnType<typeof Tesseract.recognize>>;
    try {
      result = await Tesseract.recognize(params.rawBytes, language, {
        logger: this.logger as never,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      throw new Error(`${OCR_ERROR_CODES.RECOGNIZE_FAILED}:${msg}`);
    }

    const data = result.data as unknown as {
      text?: string;
      confidence?: number;
      blocks?: Array<{
        paragraphs?: Array<{
          lines?: Array<{
            words?: Array<{ text?: string; confidence?: number }>;
          }>;
        }>;
      }>;
    };
    const text = data.text ?? "";
    const words: OcrWord[] = [];
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs ?? []) {
        for (const line of para.lines ?? []) {
          for (const w of line.words ?? []) {
            words.push({
              text: w.text ?? "",
              confidence: typeof w.confidence === "number" ? w.confidence : 0,
            });
          }
        }
      }
    }
    const meanConfidence = words.length
      ? words.reduce((sum, w) => sum + w.confidence, 0) / words.length
      : 0;

    return {
      sourceName: params.sourceName.trim(),
      sha256,
      byteLength: params.rawBytes.length,
      receivedAt,
      text,
      meanConfidence,
      words,
      engine: this.engine,
      engineVersion: (Tesseract as unknown as { version?: string }).version ?? "unknown",
      language,
    };
  }
}