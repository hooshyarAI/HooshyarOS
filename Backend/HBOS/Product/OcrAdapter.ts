/**
 * Stage 08-IMG.2 — OCR Acquisition Adapter.
 *
 * Supporting service under the canonical FinancialDataIngestionAdapter.
 * Defines the OcrAdapter contract and a TesseractOcrAdapter reference
 * implementation. The OCR engine (`tesseract.js`) is an OPTIONAL runtime
 * dependency: it is deliberately NOT declared in this repository's runtime
 * contract (see Docs/Product/FinancialIngestionService.md — images/OCR are
 * "Deliberately NOT supported").
 *
 * Because the engine may legitimately be absent, the adapter loads it lazily
 * and fails CLOSED with `ingestion-ocr-unsupported` rather than crashing at
 * module load. Tests and callers may inject an engine explicitly. This module
 * is NOT a new Engine.
 */
import { createHash } from "node:crypto";

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

export interface OcrEngineData {
  readonly text?: string;
  readonly confidence?: number;
  readonly blocks?: ReadonlyArray<{
    readonly paragraphs?: ReadonlyArray<{
      readonly lines?: ReadonlyArray<{
        readonly words?: ReadonlyArray<{ readonly text?: string; readonly confidence?: number }>;
      }>;
    }>;
  }>;
}

/** Minimal surface the adapter needs from an OCR engine (e.g. tesseract.js). */
export interface OcrEngine {
  readonly version?: string;
  recognize(bytes: Buffer, language: string, options?: { readonly logger?: unknown }): Promise<{ readonly data?: OcrEngineData }>;
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
  /**
   * Optional pre-resolved OCR engine. When omitted the adapter lazily loads
   * `tesseract.js`; if that module is not installed it fails closed with
   * `ingestion-ocr-unsupported`.
   */
  readonly engine?: OcrEngine;
}

/**
 * Resolve the optional `tesseract.js` engine without a static import, so an
 * environment that does not ship OCR never breaks module loading. The `loader`
 * parameter exists so the absent/malformed/present paths can be verified
 * deterministically without installing the dependency.
 */
export const loadTesseractEngine = (loader: (id: string) => unknown = require): OcrEngine => {
  let loaded: unknown;
  try {
    loaded = loader("tesseract.js");
  } catch {
    throw new Error(OCR_ERROR_CODES.UNSUPPORTED);
  }
  const namespace = loaded && typeof loaded === "object" ? (loaded as Record<string, unknown>) : undefined;
  const candidate = namespace && "default" in namespace ? namespace.default : loaded;
  if (!candidate || typeof (candidate as OcrEngine).recognize !== "function") {
    throw new Error(OCR_ERROR_CODES.UNSUPPORTED);
  }
  return candidate as OcrEngine;
};

export class TesseractOcrAdapter implements OcrAdapter {
  readonly engine = "tesseract.js";
  private readonly language: string;
  private readonly logger: unknown;
  private readonly injectedEngine?: OcrEngine;

  constructor(options: TesseractOcrAdapterOptions = {}) {
    this.language = options.language ?? "eng";
    this.logger = options.logger;
    this.injectedEngine = options.engine;
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

    // Resolve the engine BEFORE the recognition try/catch so an absent
    // dependency fails closed with `ingestion-ocr-unsupported` instead of
    // being reported as a recognition failure.
    const engine = this.injectedEngine ?? loadTesseractEngine();

    let result: { readonly data?: OcrEngineData };
    try {
      result = await engine.recognize(params.rawBytes, language, { logger: this.logger });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      throw new Error(`${OCR_ERROR_CODES.RECOGNIZE_FAILED}:${msg}`);
    }

    const data = result.data ?? {};
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
      engineVersion: engine.version ?? "unknown",
      language,
    };
  }
}
