/**
 * Stage 08-IMG.2 — OCR Acquisition Adapter tests.
 *
 * The OCR engine (`tesseract.js`) is an optional, undeclared dependency in
 * this repository; OCR is explicitly outside the supported ingestion runtime
 * contract (Docs/Product/FinancialIngestionService.md). These tests therefore
 * drive the adapter through an injected engine and verify the fail-closed
 * `ingestion-ocr-unsupported` boundary deterministically, without installing
 * or importing the absent dependency.
 */
import { OCR_ERROR_CODES, TesseractOcrAdapter, loadTesseractEngine, type OcrEngine } from "../Product/OcrAdapter";

const makeEngine = (recognize: jest.Mock, version = "7.0.0-test"): OcrEngine => ({ version, recognize });

describe("OcrAdapter (Stage 08-IMG.2)", () => {
  test("recognize returns text and per-word confidences", async () => {
    const recognize = jest.fn().mockResolvedValue({
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
    const adapter = new TesseractOcrAdapter({ engine: makeEngine(recognize) });
    const result = await adapter.recognize({ sourceName: "a.png", rawBytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]) });
    expect(result.text).toBe("Hello world");
    expect(result.meanConfidence).toBe(85);
    expect(result.words).toHaveLength(2);
    expect(result.engine).toBe("tesseract.js");
    expect(result.engineVersion).toBe("7.0.0-test");
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  test("recognize respects custom language", async () => {
    const recognize = jest.fn().mockResolvedValue({ data: { text: "", blocks: [] } });
    const adapter = new TesseractOcrAdapter({ language: "fas", engine: makeEngine(recognize) });
    await adapter.recognize({ sourceName: "x.png", rawBytes: Buffer.from("x") });
    expect(recognize).toHaveBeenCalledWith(expect.any(Buffer), "fas", expect.any(Object));
  });

  test("recognize rejects empty buffer before touching the engine", async () => {
    const recognize = jest.fn();
    const adapter = new TesseractOcrAdapter({ engine: makeEngine(recognize) });
    await expect(adapter.recognize({ sourceName: "x.png", rawBytes: Buffer.alloc(0) }))
      .rejects.toThrow(OCR_ERROR_CODES.EMPTY);
    expect(recognize).not.toHaveBeenCalled();
  });

  test("recognize wraps engine errors as ingestion-ocr-recognize-failed", async () => {
    const recognize = jest.fn().mockRejectedValue(new Error("worker crashed"));
    const adapter = new TesseractOcrAdapter({ engine: makeEngine(recognize) });
    await expect(adapter.recognize({ sourceName: "x.png", rawBytes: Buffer.from("x") }))
      .rejects.toThrow(/ingestion-ocr-recognize-failed/);
  });

  test("recognize handles missing words array gracefully", async () => {
    const recognize = jest.fn().mockResolvedValue({ data: { text: "no words here", blocks: [] } });
    const adapter = new TesseractOcrAdapter({ engine: makeEngine(recognize) });
    const result = await adapter.recognize({ sourceName: "a.png", rawBytes: Buffer.from("x") });
    expect(result.words).toEqual([]);
    expect(result.meanConfidence).toBe(0);
    expect(result.text).toBe("no words here");
  });

  test("recognize uses receivedAt when supplied", async () => {
    const recognize = jest.fn().mockResolvedValue({ data: { text: "", blocks: [] } });
    const adapter = new TesseractOcrAdapter({ engine: makeEngine(recognize) });
    const fixedAt = "2026-09-03T00:00:00.000Z";
    const result = await adapter.recognize({
      sourceName: "a.png", rawBytes: Buffer.from("x"), receivedAt: fixedAt,
    });
    expect(result.receivedAt).toBe(fixedAt);
  });

  test("reports unknown engine version when the engine does not advertise one", async () => {
    const recognize = jest.fn().mockResolvedValue({ data: { text: "", blocks: [] } });
    const adapter = new TesseractOcrAdapter({ engine: { recognize } });
    const result = await adapter.recognize({ sourceName: "a.png", rawBytes: Buffer.from("x") });
    expect(result.engineVersion).toBe("unknown");
  });

  describe("optional dependency boundary (fail closed)", () => {
    test("loadTesseractEngine reports ingestion-ocr-unsupported when the module cannot be loaded", () => {
      const missing = () => { throw new Error("MODULE_NOT_FOUND"); };
      expect(() => loadTesseractEngine(missing)).toThrow(OCR_ERROR_CODES.UNSUPPORTED);
    });

    test("loadTesseractEngine rejects a module without a recognize function", () => {
      expect(() => loadTesseractEngine(() => ({}))).toThrow(OCR_ERROR_CODES.UNSUPPORTED);
      expect(() => loadTesseractEngine(() => ({ default: {} }))).toThrow(OCR_ERROR_CODES.UNSUPPORTED);
    });

    test("loadTesseractEngine resolves a CommonJS or ESM-shaped module", () => {
      const recognize = jest.fn();
      const cjs = loadTesseractEngine(() => ({ recognize, version: "7.0.0" }));
      expect(cjs.recognize).toBe(recognize);
      const esm = loadTesseractEngine(() => ({ default: { recognize, version: "7.0.0" } }));
      expect(esm.recognize).toBe(recognize);
    });

    test("recognize fails closed with ingestion-ocr-unsupported when no engine is available", async () => {
      // No injected engine and tesseract.js is absent in this environment.
      const adapter = new TesseractOcrAdapter();
      await expect(adapter.recognize({ sourceName: "x.png", rawBytes: Buffer.from("x") }))
        .rejects.toThrow(OCR_ERROR_CODES.UNSUPPORTED);
    });
  });
});
