/**
 * Stage 08-DOC.3 — DOCX + DOC acquisition focused tests.
 */
import {
  DOCX_ERROR_CODES,
  acquireDocx,
  detectDocFormatByExtension,
  detectDocxMagic,
} from "../Product/DocxAcquisition";

jest.mock("mammoth", () => ({
  extractRawText: jest.fn(),
}));

import * as mammoth from "mammoth";
const mammothMock = mammoth as unknown as { extractRawText: jest.Mock };

const ZIP_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

describe("DocxAcquisition (Stage 08-DOC.3)", () => {
  beforeEach(() => { mammothMock.extractRawText.mockReset(); });

  test("detectDocxMagic returns true for ZIP header", () => {
    expect(detectDocxMagic(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]))).toBe(true);
  });
  test("detectDocxMagic returns false for non-ZIP", () => {
    expect(detectDocxMagic(Buffer.from("hello"))).toBe(false);
    expect(detectDocxMagic(Buffer.alloc(0))).toBe(false);
  });

  test("detectDocFormatByExtension classifies .docx and .doc", () => {
    expect(detectDocFormatByExtension("a.docx")).toBe("DOCX");
    expect(detectDocFormatByExtension("a.DOC")).toBe("DOC");
    expect(detectDocFormatByExtension("a.txt")).toBeNull();
  });

  test("acquireDocx rejects .doc files (legacy binary not supported)", async () => {
    const buffer = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), Buffer.alloc(100)]);
    await expect(acquireDocx({ sourceName: "old.doc", rawBytes: buffer }))
      .rejects.toThrow(DOCX_ERROR_CODES.DOC_NOT_SUPPORTED);
  });

  test("acquireDocx rejects empty buffer", async () => {
    await expect(acquireDocx({ sourceName: "a.docx", rawBytes: Buffer.alloc(0) }))
      .rejects.toThrow(DOCX_ERROR_CODES.EMPTY);
  });

  test("acquireDocx rejects mismatched extension", async () => {
    await expect(acquireDocx({ sourceName: "wrong.txt", rawBytes: ZIP_HEADER }))
      .rejects.toThrow(DOCX_ERROR_CODES.MISMATCH);
  });

  test("acquireDocx rejects non-ZIP bytes for .docx", async () => {
    await expect(acquireDocx({ sourceName: "a.docx", rawBytes: Buffer.from("plain text") }))
      .rejects.toThrow(DOCX_ERROR_CODES.UNSUPPORTED);
  });

  test("acquireDocx extracts text via mammoth and exposes messages", async () => {
    mammothMock.extractRawText.mockResolvedValue({
      value: "Hello world from docx",
      messages: [{ type: "info", message: "ok" }],
    });
    const result = await acquireDocx({ sourceName: "doc.docx", rawBytes: ZIP_HEADER });
    expect(result.text).toBe("Hello world from docx");
    expect(result.messages).toEqual(["ok"]);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  test("acquireDocx surfaces mammoth parse errors as ingestion-docx-parse-error", async () => {
    mammothMock.extractRawText.mockRejectedValue(new Error("zip bad"));
    await expect(acquireDocx({ sourceName: "doc.docx", rawBytes: ZIP_HEADER }))
      .rejects.toThrow(/ingestion-docx-parse-error/);
  });
});