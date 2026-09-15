/**
 * Stage 08-IMG.4 — Scanned-PDF -> OCR routing tests.
 */
import type { OcrAdapter, OcrResult } from "../Product/OcrAdapter";
import {
  SCANNED_ROUTING_ERROR_CODES,
  decideScannedPages,
  routeScannedPdfToOcr,
} from "../Product/ScannedPdfRouter";
import type { PdfTextDocument } from "../Product/PdfAcquisition";

function makePdf(pages: Array<{ pageNumber: number; text: string }>): PdfTextDocument {
  return {
    sourceName: "doc.pdf",
    sha256: "x".repeat(64),
    byteLength: 1000,
    receivedAt: "2026-01-01T00:00:00Z",
    pageCount: pages.length,
    text: pages.map((p) => p.text).join("\n"),
    pages: pages.map((p) => ({ pageNumber: p.pageNumber, text: p.text, charCount: p.text.length })),
    metadata: {},
    averageCharsPerPage: pages.reduce((s, p) => s + p.text.length, 0) / Math.max(1, pages.length),
  };
}

function makeOcrStub(perPage: (pageNumber: number) => OcrResult): OcrAdapter {
  return {
    engine: "stub",
    recognize: async ({ sourceName }: { sourceName: string; rawBytes: Buffer }) => {
      const m = sourceName.match(/#page-(\d+)/);
      const pageNumber = m ? Number(m[1]) : 0;
      return perPage(pageNumber);
    },
  };
}

describe("ScannedPdfRouter (Stage 08-IMG.4)", () => {
  test("decideScannedPages flags only low-char pages", () => {
    const pdf = makePdf([
      { pageNumber: 1, text: "x".repeat(500) },
      { pageNumber: 2, text: "x".repeat(10) },
      { pageNumber: 3, text: "x".repeat(0) },
    ]);
    const decisions = decideScannedPages(pdf, 50);
    expect(decisions[0].needsOcr).toBe(false);
    expect(decisions[1].needsOcr).toBe(true);
    expect(decisions[2].needsOcr).toBe(true);
  });

  test("routeScannedPdfToOcr skips text-native pages and OCRs the rest", async () => {
    const pdf = makePdf([
      { pageNumber: 1, text: "x".repeat(500) },
      { pageNumber: 2, text: "" },
    ]);
    const rasterized: number[] = [];
    const rasterize = async (n: number) => { rasterized.push(n); return Buffer.from(`img-${n}`); };
    const ocr = makeOcrStub((n) => ({
      sourceName: `p${n}`, sha256: "x".repeat(64), byteLength: 10,
      receivedAt: "2026-01-01", text: `ocr p${n}`, meanConfidence: 70, words: [],
      engine: "stub", engineVersion: "0", language: "eng",
    }));
    const result = await routeScannedPdfToOcr(pdf, ocr, { rasterizePage: rasterize, textNativeCharsPerPage: 50 });
    expect(result.anyRoutedToOcr).toBe(true);
    expect(result.ocrResults).toHaveLength(1);
    expect(result.ocrResults[0].text).toBe("ocr p2");
    expect(rasterized).toEqual([2]);
  });

  test("routeScannedPdfToOcr returns empty when all pages text-native", async () => {
    const pdf = makePdf([
      { pageNumber: 1, text: "x".repeat(500) },
      { pageNumber: 2, text: "y".repeat(300) },
    ]);
    const rasterize = jest.fn();
    const ocr = makeOcrStub(() => { throw new Error("should not be called"); });
    const result = await routeScannedPdfToOcr(pdf, ocr, { rasterizePage: rasterize });
    expect(result.anyRoutedToOcr).toBe(false);
    expect(result.ocrResults).toEqual([]);
    expect(rasterize).not.toHaveBeenCalled();
  });

  test("routeScannedPdfToOcr rejects negative threshold", async () => {
    const pdf = makePdf([{ pageNumber: 1, text: "" }]);
    const ocr = makeOcrStub(() => { throw new Error("x"); });
    await expect(routeScannedPdfToOcr(pdf, ocr, {
      rasterizePage: async () => Buffer.alloc(0), textNativeCharsPerPage: -1,
    })).rejects.toThrow(SCANNED_ROUTING_ERROR_CODES.PAGE_BUDGET_INVALID);
  });

  test("routeScannedPdfToOcr surfaces per-page timeout", async () => {
    const pdf = makePdf([{ pageNumber: 1, text: "" }]);
    const slowOcr: OcrAdapter = {
      engine: "slow", recognize: () => new Promise(() => { /* never resolves */ }) as unknown as Promise<OcrResult>,
    };
    await expect(routeScannedPdfToOcr(pdf, slowOcr, {
      rasterizePage: async () => Buffer.alloc(1), perPageOcrTimeoutMs: 50,
    })).rejects.toThrow(/ingestion-ocr-page-timeout/);
  });
});