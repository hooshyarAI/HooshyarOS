/**
 * Stage 08-IMG.2 — OCR Acquisition Adapter tests.
 */
jest.mock("tesseract.js", () => {
  const recognize = jest.fn();
  return {
    __esModule: true,
    default: { recognize, version: "7.0.0-test" },
    recognize,
    version: "7.0.0-test",
  };
});

import Tesseract from "tesseract.js";
import { OCR_ERROR_CODES, TesseractOcrAdapter } from "../Product/OcrAdapter";

const recognizeMock = (Tesseract as unknown as { recognize: jest.Mock }).recognize;

describe("OcrAdapter (Stage 08-IMG.2)", () => {
  beforeEach(() => { recognizeMock.mockReset(); });

  test("recognize returns text and per-word confidences", async () => {
    recognizeMock.mockResolvedValue({
      data: {
        text: "Hello world",
        blocks: [{
          paragraphs: [{
            lines: [{
              words: [
                { text: "Hello", confidence: 90 },
                { text: "world", confidence: 80 },
              ],
            }],
          }],
        }],
      },
    });
    const adapter = new TesseractOcrAdapter();
    const result = await adapter.recognize({ sourceName: "a.png", rawBytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]) });
    expect(result.text).toBe("Hello world");
    expect(result.meanConfidence).toBe(85);
    expect(result.words).toHaveLength(2);
    expect(result.engine).toBe("tesseract.js");
    expect(result.engineVersion).toBe("7.0.0-test");
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  test("recognize respects custom language", async () => {
    recognizeMock.mockResolvedValue({ data: { text: "", blocks: [] } });
    const adapter = new TesseractOcrAdapter({ language: "fas" });
    await adapter.recognize({ sourceName: "x.png", rawBytes: Buffer.from("x") });
    expect(recognizeMock).toHaveBeenCalledWith(expect.any(Buffer), "fas", expect.any(Object));
  });

  test("recognize rejects empty buffer", async () => {
    const adapter = new TesseractOcrAdapter();
    await expect(adapter.recognize({ sourceName: "x.png", rawBytes: Buffer.alloc(0) }))
      .rejects.toThrow(OCR_ERROR_CODES.EMPTY);
  });

  test("recognize wraps tesseract errors as ingestion-ocr-recognize-failed", async () => {
    recognizeMock.mockRejectedValue(new Error("worker crashed"));
    const adapter = new TesseractOcrAdapter();
    await expect(adapter.recognize({ sourceName: "x.png", rawBytes: Buffer.from("x") }))
      .rejects.toThrow(/ingestion-ocr-recognize-failed/);
  });

  test("recognize handles missing words array gracefully", async () => {
    recognizeMock.mockResolvedValue({ data: { text: "no words here", blocks: [] } });
    const adapter = new TesseractOcrAdapter();
    const result = await adapter.recognize({ sourceName: "a.png", rawBytes: Buffer.from("x") });
    expect(result.words).toEqual([]);
    expect(result.meanConfidence).toBe(0);
    expect(result.text).toBe("no words here");
  });

  test("recognize uses receivedAt when supplied", async () => {
    recognizeMock.mockResolvedValue({ data: { text: "", blocks: [] } });
    const adapter = new TesseractOcrAdapter();
    const fixedAt = "2026-09-03T00:00:00.000Z";
    const result = await adapter.recognize({
      sourceName: "a.png", rawBytes: Buffer.from("x"), receivedAt: fixedAt,
    });
    expect(result.receivedAt).toBe(fixedAt);
  });
});