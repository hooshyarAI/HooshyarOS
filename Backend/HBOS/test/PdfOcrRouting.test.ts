/**
 * Governed scanned-PDF / image OCR routing focused tests.
 *
 * Proves the OCR half of the ingestion fabric exists and is BOUNDED:
 *   - a real page rasterizer provider (pdf-parse screenshots) behind an
 *     injectable boundary;
 *   - an explicit, caller-supplied OCR adapter route that records truthful OCR
 *     provenance anchored to the ORIGINAL bytes;
 *   - fail-closed behaviour when no OCR engine is available (no fake OCR).
 *
 * OCR remains DEFERRED in the provider inventory: these tests exercise the
 * route through an injected engine, never a claimed production engine.
 */
import { createHash } from "node:crypto";
import { PDFParse } from "pdf-parse";

jest.mock("pdf-parse", () => ({ PDFParse: jest.fn() }));

import {
  PDF_RASTERIZER_ERROR_CODES,
  createPdfPageRasterizer,
  type PdfParserFactory,
} from "../Product/PdfPageRasterizer";
import { TesseractOcrAdapter, type OcrAdapter, type OcrResult } from "../Product/OcrAdapter";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { FinancialDataIngestionAdapter } from "../Product/FinancialDataIngestionAdapter";

const PDFParseMock = PDFParse as unknown as jest.Mock;
const PDF_BYTES = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(128, 0x20)]);

const CSV_HEADER = "date,account,debit,credit,currency";

function scannedPdfMock(): void {
  PDFParseMock.mockImplementation(() => ({
    getInfo: async () => ({ info: {}, metadata: null, total: 2 }),
    getText: async () => ({
      pages: [{ num: 1, text: "" }, { num: 2, text: " " }],
      text: " ",
      total: 2,
      getPageText: () => "",
    }),
    destroy: async () => undefined,
  }));
}

function ocrResult(sourceName: string, text: string): OcrResult {
  return {
    sourceName,
    sha256: "a".repeat(64),
    byteLength: 3,
    receivedAt: "2026-09-19T00:00:00.000Z",
    text,
    meanConfidence: 88,
    words: [{ text: "x", confidence: 88 }],
    engine: "stub-ocr",
    engineVersion: "1.0.0",
    language: "eng",
  };
}

function ocrStub(perPage: (pageNumber: number) => string): OcrAdapter {
  return {
    engine: "stub-ocr",
    recognize: async ({ sourceName }) => {
      const match = sourceName.match(/#page-(\d+)/);
      return ocrResult(sourceName, perPage(match ? Number(match[1]) : 0));
    },
  };
}

describe("PdfPageRasterizer (real provider boundary)", () => {
  const factoryWith = (pages: Array<{ data: Uint8Array; width?: number; height?: number }>): PdfParserFactory =>
    () => ({
      getScreenshot: async () => ({ pages }),
      destroy: async () => undefined,
    });

  test("renders pages to PNG bytes and serves them by 1-based page number", async () => {
    const rasterizer = createPdfPageRasterizer(
      { rawBytes: PDF_BYTES },
      factoryWith([
        { data: new Uint8Array([0x89, 0x50]), width: 100, height: 200 },
        { data: new Uint8Array([0x89, 0x51]), width: 100, height: 200 },
      ]),
    );
    const page = await rasterizer.rasterizePage(2);
    expect(page).toEqual(Buffer.from([0x89, 0x51]));
    expect(rasterizer.provider).toMatch(/pdf-parse/);
  });

  test("rejects non-PDF bytes before touching the engine", () => {
    expect(() => createPdfPageRasterizer({ rawBytes: Buffer.from("not a pdf") }))
      .toThrow(PDF_RASTERIZER_ERROR_CODES.UNSUPPORTED);
    expect(() => createPdfPageRasterizer({ rawBytes: Buffer.alloc(0) }))
      .toThrow(PDF_RASTERIZER_ERROR_CODES.EMPTY);
  });

  test("fails closed for an out-of-range page and for a parser that yields nothing", async () => {
    const rasterizer = createPdfPageRasterizer(
      { rawBytes: PDF_BYTES },
      factoryWith([{ data: new Uint8Array([1]), width: 1, height: 1 }]),
    );
    await expect(rasterizer.rasterizePage(9)).rejects.toThrow(PDF_RASTERIZER_ERROR_CODES.PAGE_OUT_OF_RANGE);

    const empty = createPdfPageRasterizer({ rawBytes: PDF_BYTES }, factoryWith([]));
    await expect(empty.rasterizeAll()).rejects.toThrow(/ingestion-pdf-rasterize-failed/);
  });
});

describe("FinancialDataIngestionAdapter — governed OCR routes", () => {
  let store: SQLitePersistenceStore;
  let adapter: FinancialDataIngestionAdapter;

  beforeEach(() => {
    store = new SQLitePersistenceStore({ databasePath: ":memory:" });
    adapter = new FinancialDataIngestionAdapter(store);
    PDFParseMock.mockReset();
  });

  afterEach(() => {
    try { store.close(); } catch { /* ignore */ }
  });

  test("default pdf route still fails closed for a scanned PDF", async () => {
    scannedPdfMock();
    await expect(adapter.ingestPdfBytes("t1", "scan.pdf", PDF_BYTES))
      .rejects.toThrow("ingestion-pdf-scanned-no-ocr-yet");
  });

  test("scanned PDF is ingested through an injected OCR engine with provenance", async () => {
    scannedPdfMock();
    const ocr = ocrStub((page) =>
      page === 1 ? `${CSV_HEADER}\n2026-08-01,Cash,100,0,IRR` : "2026-08-02,Sales,0,50,IRR",
    );

    const result = await adapter.ingestScannedPdfBytes("t1", "scan.pdf", PDF_BYTES, {
      ocr,
      rasterizePage: async (page) => Buffer.from(`rendered-${page}`),
    });

    expect(result.model.transactions).toHaveLength(2);
    expect(result.evidence.sourceType).toBe("PDF");
    expect(result.evidence.sha256).toBe(createHash("sha256").update(PDF_BYTES).digest("hex"));
    expect(result.evidence.ocr?.ocrEngine).toBe("stub-ocr");
    expect(result.evidence.ocr?.ocrConfidence).toBe(88);
    expect(result.evidence.ocr?.ocrLanguage).toBe("eng");
  });

  test("image OCR is ingested with original-image provenance and fails closed without an engine", async () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(32, 0xab),
    ]);
    const ocr = ocrStub(() => `${CSV_HEADER}\n2026-08-01,Cash,100,0,IRR`);

    const result = await adapter.ingestImageBytes("t1", "scan.png", png, ocr);
    expect(result.model.transactions).toHaveLength(1);
    expect(result.evidence.sourceType).toBe("IMAGE");
    expect(result.evidence.sha256).toBe(createHash("sha256").update(png).digest("hex"));
    expect(result.evidence.ocr?.ocrEngine).toBe("stub-ocr");

    const missingEngine = new TesseractOcrAdapter();
    await expect(adapter.ingestImageBytes("t1", "scan.png", png, missingEngine))
      .rejects.toThrow(/ingestion-ocr-unsupported/);
  });
});
