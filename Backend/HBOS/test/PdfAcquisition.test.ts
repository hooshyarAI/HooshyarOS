/**
 * Stage 08-DOC.2 — PDF text-native acquisition focused tests.
 */
import { PDFParse } from "pdf-parse";
import { PDF_ERROR_CODES, acquirePdf, detectPdfMagic } from "../Product/PdfAcquisition";

jest.mock("pdf-parse", () => ({ PDFParse: jest.fn() }));

const PDFParseMock = PDFParse as unknown as jest.Mock;

function makePdfHeader(extra: Buffer = Buffer.alloc(0)): Buffer {
  return Buffer.concat([Buffer.from("%PDF-1.7\n"), extra]);
}

describe("PdfAcquisition (Stage 08-DOC.2)", () => {
  beforeEach(() => { PDFParseMock.mockReset(); });

  test("detectPdfMagic returns true for valid %PDF header", () => {
    expect(detectPdfMagic(makePdfHeader())).toBe(true);
  });

  test("detectPdfMagic returns false for non-PDF bytes", () => {
    expect(detectPdfMagic(Buffer.from("PNG\r\n"))).toBe(false);
    expect(detectPdfMagic(Buffer.alloc(0))).toBe(false);
  });

  test("acquirePdf returns text + metadata for native-text PDF", async () => {
    PDFParseMock.mockImplementation(() => ({
      getInfo: async () => ({ info: { Title: "Ledger", Author: "Alice" }, metadata: null, total: 2 }),
      getText: async () => ({
        pages: [
          { num: 1, text: "Hello world this is native text on page one with more content for testing purposes here" },
          { num: 2, text: "Second page of text content here for testing the full ingestion pipeline threshold" },
        ],
        text: "combined", total: 2, getPageText: () => "",
      }),
      destroy: async () => undefined,
    }));

    const result = await acquirePdf({ sourceName: "ledger.pdf", rawBytes: makePdfHeader(Buffer.alloc(100)) });
    expect(result.pageCount).toBe(2);
    expect(result.averageCharsPerPage).toBeGreaterThan(20);
    expect(result.metadata.title).toBe("Ledger");
    expect(result.metadata.author).toBe("Alice");
    expect(result.text).toContain("native text");
  });

  test("acquirePdf throws SCANNED for image-only PDF (low chars/page)", async () => {
    PDFParseMock.mockImplementation(() => ({
      getInfo: async () => ({ info: {}, metadata: null, total: 3 }),
      getText: async () => ({
        pages: [{ num: 1, text: "" }, { num: 2, text: " " }, { num: 3, text: "" }],
        text: " ", total: 3, getPageText: () => "",
      }),
      destroy: async () => undefined,
    }));
    await expect(acquirePdf({
      sourceName: "scan.pdf", rawBytes: makePdfHeader(),
      options: { scannedThresholdCharsPerPage: 50 },
    })).rejects.toThrow(PDF_ERROR_CODES.SCANNED);
  });

  test("acquirePdf throws PASSWORD when underlying error mentions password", async () => {
    PDFParseMock.mockImplementation(() => ({
      getInfo: async () => { throw new Error("PDF is encrypted and requires a password"); },
      getText: async () => ({ pages: [], text: "", total: 0, getPageText: () => "" }),
      destroy: async () => undefined,
    }));
    await expect(acquirePdf({ sourceName: "locked.pdf", rawBytes: makePdfHeader() })).rejects.toThrow(PDF_ERROR_CODES.PASSWORD);
  });

  test("acquirePdf throws CORRUPT for malformed PDF", async () => {
    PDFParseMock.mockImplementation(() => ({
      getInfo: async () => { throw new Error("Invalid PDF structure"); },
      getText: async () => ({ pages: [], text: "", total: 0, getPageText: () => "" }),
      destroy: async () => undefined,
    }));
    await expect(acquirePdf({ sourceName: "broken.pdf", rawBytes: makePdfHeader() })).rejects.toThrow(PDF_ERROR_CODES.CORRUPT);
  });

  test("acquirePdf rejects empty buffer", async () => {
    await expect(acquirePdf({ sourceName: "empty.pdf", rawBytes: Buffer.alloc(0) })).rejects.toThrow(PDF_ERROR_CODES.EMPTY);
  });

  test("acquirePdf rejects non-PDF magic bytes", async () => {
    await expect(acquirePdf({ sourceName: "fake.pdf", rawBytes: Buffer.from("NOT A PDF") })).rejects.toThrow(PDF_ERROR_CODES.UNSUPPORTED);
  });

  test("acquirePdf rejects when extension does not match", async () => {
    await expect(acquirePdf({ sourceName: "wrong.txt", rawBytes: makePdfHeader() })).rejects.toThrow(PDF_ERROR_CODES.MISMATCH);
  });

  test("acquirePdf computes deterministic SHA-256", async () => {
    PDFParseMock.mockImplementation(() => ({
      getInfo: async () => ({ info: {}, metadata: null, total: 1 }),
      getText: async () => ({
        pages: [{ num: 1, text: "x".repeat(200) }], text: "x".repeat(200), total: 1, getPageText: () => "",
      }),
      destroy: async () => undefined,
    }));
    const a = await acquirePdf({ sourceName: "a.pdf", rawBytes: makePdfHeader(Buffer.alloc(50)) });
    const b = await acquirePdf({ sourceName: "b.pdf", rawBytes: makePdfHeader(Buffer.alloc(50)) });
    expect(a.sha256).toBe(b.sha256);
  });
});