/**
 * Stage 08-IMG.3 — OCR Provenance tests.
 */
import {
  OCR_PROVENANCE_ERROR_CODES,
  createOcrProvenance,
  withOcrProvenance,
} from "../Product/OcrProvenance";

describe("OcrProvenance (Stage 08-IMG.3)", () => {
  test("createOcrProvenance with valid confidence", () => {
    const p = createOcrProvenance({
      engine: "tesseract.js", engineVersion: "7.0.0", confidence: 85.5, language: "eng",
    });
    expect(p.ocrEngine).toBe("tesseract.js");
    expect(p.ocrEngineVersion).toBe("7.0.0");
    expect(p.ocrConfidence).toBe(85.5);
    expect(p.ocrLanguage).toBe("eng");
    expect(p.ocrExtractedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("createOcrProvenance accepts null confidence (no fabrication)", () => {
    const p = createOcrProvenance({
      engine: "tesseract.js", engineVersion: "7.0.0", confidence: null, language: "eng",
    });
    expect(p.ocrConfidence).toBeNull();
  });

  test("createOcrProvenance rejects negative confidence", () => {
    expect(() => createOcrProvenance({
      engine: "t", engineVersion: "1", confidence: -1, language: "eng",
    })).toThrow(OCR_PROVENANCE_ERROR_CODES.INVALID_CONFIDENCE);
  });

  test("createOcrProvenance rejects confidence > 100", () => {
    expect(() => createOcrProvenance({
      engine: "t", engineVersion: "1", confidence: 101, language: "eng",
    })).toThrow(OCR_PROVENANCE_ERROR_CODES.INVALID_CONFIDENCE);
  });

  test("createOcrProvenance rejects NaN confidence", () => {
    expect(() => createOcrProvenance({
      engine: "t", engineVersion: "1", confidence: NaN, language: "eng",
    })).toThrow(OCR_PROVENANCE_ERROR_CODES.INVALID_CONFIDENCE);
  });

  test("createOcrProvenance rejects empty engine", () => {
    expect(() => createOcrProvenance({
      engine: "", engineVersion: "1", confidence: 50, language: "eng",
    })).toThrow(OCR_PROVENANCE_ERROR_CODES.INVALID_ENGINE);
  });

  test("createOcrProvenance rejects empty language", () => {
    expect(() => createOcrProvenance({
      engine: "t", engineVersion: "1", confidence: 50, language: "",
    })).toThrow(OCR_PROVENANCE_ERROR_CODES.INVALID_ENGINE);
  });

  test("createOcrProvenance respects explicit extractedAt", () => {
    const at = "2026-09-03T12:00:00.000Z";
    const p = createOcrProvenance({
      engine: "t", engineVersion: "1", confidence: 50, language: "eng", extractedAt: at,
    });
    expect(p.ocrExtractedAt).toBe(at);
  });

  test("withOcrProvenance attaches ocr field without mutating base", () => {
    const base = { sourceName: "x.png", sourceType: "IMAGE", sha256: "abc", receivedAt: "2026-01-01" };
    const ocr = createOcrProvenance({
      engine: "tesseract.js", engineVersion: "7.0.0", confidence: 90, language: "eng",
    });
    const result = withOcrProvenance(base, ocr);
    expect(result.ocr).toEqual(ocr);
    expect(result.sourceName).toBe("x.png");
    expect(base).not.toHaveProperty("ocr");
  });
});