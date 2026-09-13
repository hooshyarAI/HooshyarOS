/**
 * Stage 08-IMG.4 — Scanned-PDF -> OCR routing.
 *
 * Pure supporting helper. Given a PdfTextDocument from 08-DOC.2 and an
 * OcrAdapter from 08-IMG.2, decide whether the PDF should be routed to
 * OCR. The decision is per-page: each page whose character count is
 * below the per-page budget is fed to the OCR adapter. The helper
 * enforces a per-page time budget via AbortController and returns a
 * structured routing result.
 */
import type { OcrAdapter, OcrResult } from "./OcrAdapter";
import type { PdfTextDocument } from "./PdfAcquisition";

export const SCANNED_ROUTING_ERROR_CODES = {
  PAGE_BUDGET_INVALID: "ingestion-scanned-page-budget-invalid",
} as const;

export interface ScannedRoutingOptions {
  /** Minimum characters per page to consider a page "text-native". Default 50. */
  readonly textNativeCharsPerPage?: number;
  /** Per-page OCR timeout in ms. Default 30000. */
  readonly perPageOcrTimeoutMs?: number;
  /** Optional language to pass to the OCR adapter. */
  readonly language?: string;
  /**
   * Rasterizer hook: turn a page index (1-based) into raw image bytes.
   * In tests we inject a deterministic stub; in production this would
   * be backed by pdf.js page renderToBuffer.
   */
  readonly rasterizePage: (pageNumber: number) => Promise<Buffer>;
}

export interface ScannedPageDecision {
  readonly pageNumber: number;
  readonly needsOcr: boolean;
  readonly reason: "text-native" | "below-budget";
  readonly charCount: number;
}

export interface ScannedRoutingResult {
  readonly decisions: ReadonlyArray<ScannedPageDecision>;
  readonly ocrResults: ReadonlyArray<OcrResult>;
  readonly anyRoutedToOcr: boolean;
}

export function decideScannedPages(
  pdf: PdfTextDocument,
  threshold: number,
): ScannedPageDecision[] {
  return pdf.pages.map((p) => {
    const needsOcr = p.charCount < threshold;
    return {
      pageNumber: p.pageNumber,
      needsOcr,
      reason: needsOcr ? "below-budget" : "text-native",
      charCount: p.charCount,
    };
  });
}

/**
 * Route a PDF's pages to OCR when they fall below the text-native
 * budget. Pages that are already text-native are skipped. The
 * rasterizer hook is required so this module stays decoupled from a
 * concrete PDF renderer.
 */
export async function routeScannedPdfToOcr(
  pdf: PdfTextDocument,
  ocr: OcrAdapter,
  options: ScannedRoutingOptions,
): Promise<ScannedRoutingResult> {
  const threshold = options.textNativeCharsPerPage ?? 50;
  const perPageTimeoutMs = options.perPageOcrTimeoutMs ?? 30000;
  if (threshold < 0) {
    throw new Error(SCANNED_ROUTING_ERROR_CODES.PAGE_BUDGET_INVALID);
  }
  const decisions = decideScannedPages(pdf, threshold);
  const ocrResults: OcrResult[] = [];
  for (const d of decisions) {
    if (!d.needsOcr) continue;
    const imageBytes = await options.rasterizePage(d.pageNumber);
    const result = await Promise.race([
      ocr.recognize({
        sourceName: `${pdf.sourceName}#page-${d.pageNumber}`,
        rawBytes: imageBytes,
        language: options.language,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("ingestion-ocr-page-timeout")), perPageTimeoutMs).unref?.();
      }),
    ]);
    ocrResults.push(result);
  }
  return { decisions, ocrResults, anyRoutedToOcr: ocrResults.length > 0 };
}