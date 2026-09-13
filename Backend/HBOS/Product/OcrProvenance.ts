/**
 * Stage 08-IMG.3 — OCR Provenance / Confidence.
 *
 * Adds an OCR provenance sub-record to the ingestion evidence so downstream
 * consumers can reason about the reliability of OCR-derived text. This
 * module is NOT a new Engine. It is a pure helper that:
 *   - Defines OcrProvenance
 *   - Extends FinancialSourceEvidence consumers with an optional ocr field
 *   - Validates that confidence is never fabricated (must be null when
 *     unknown, never a guessed number)
 */

export const OCR_PROVENANCE_ERROR_CODES = {
  INVALID_CONFIDENCE: "ingestion-ocr-confidence-invalid",
  INVALID_ENGINE: "ingestion-ocr-engine-invalid",
  INVALID_TIMESTAMP: "ingestion-ocr-extracted-at-invalid",
} as const;

export interface OcrProvenance {
  readonly ocrEngine: string;
  readonly ocrEngineVersion: string;
  readonly ocrExtractedAt: string;
  /** Mean OCR confidence in [0,100], or null when unknown / unavailable. */
  readonly ocrConfidence: number | null;
  /** Language pack used (e.g. "eng", "fas+eng"). */
  readonly ocrLanguage: string;
}

export function createOcrProvenance(params: {
  readonly engine: string;
  readonly engineVersion: string;
  readonly extractedAt?: string;
  readonly confidence: number | null;
  readonly language: string;
}): OcrProvenance {
  if (typeof params.engine !== "string" || !params.engine.trim()) {
    throw new Error(OCR_PROVENANCE_ERROR_CODES.INVALID_ENGINE);
  }
  if (typeof params.engineVersion !== "string" || !params.engineVersion.trim()) {
    throw new Error(OCR_PROVENANCE_ERROR_CODES.INVALID_ENGINE);
  }
  if (params.confidence !== null) {
    if (typeof params.confidence !== "number" || !Number.isFinite(params.confidence)) {
      throw new Error(OCR_PROVENANCE_ERROR_CODES.INVALID_CONFIDENCE);
    }
    if (params.confidence < 0 || params.confidence > 100) {
      throw new Error(OCR_PROVENANCE_ERROR_CODES.INVALID_CONFIDENCE);
    }
  }
  const extractedAt = params.extractedAt ?? new Date().toISOString();
  if (Number.isNaN(new Date(extractedAt).getTime())) {
    throw new Error(OCR_PROVENANCE_ERROR_CODES.INVALID_TIMESTAMP);
  }
  if (typeof params.language !== "string" || !params.language.trim()) {
    throw new Error(OCR_PROVENANCE_ERROR_CODES.INVALID_ENGINE);
  }
  return {
    ocrEngine: params.engine.trim(),
    ocrEngineVersion: params.engineVersion.trim(),
    ocrExtractedAt: extractedAt,
    ocrConfidence: params.confidence,
    ocrLanguage: params.language.trim(),
  };
}

/**
 * Attach an OcrProvenance to a base source-evidence record. Returns a new
 * object — the input is not mutated. This is the helper that the adapter
 * uses when an OCR pipeline produced the text that was then normalized
 * into the canonical transaction list.
 */
export function withOcrProvenance<T extends object>(
  base: T,
  ocr: OcrProvenance,
): T & { readonly ocr: OcrProvenance } {
  return { ...base, ocr };
}