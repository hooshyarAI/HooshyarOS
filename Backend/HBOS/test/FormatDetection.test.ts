/**
 * Stage 08-F.2 — Format & Source Detection focused tests.
 */
import {
  classifySourceByContent,
  detectFormatByExtension,
  detectFormatByMagic,
  detectSourceFormat,
  detectStructuredByContent,
  FORMAT_DETECTION_ERROR_CODES,
  MAGIC_TABLE,
  type DetectedFormat,
} from "../Product/FormatDetection";

describe("FormatDetection (Stage 08-F.2)", () => {
  describe("detectFormatByMagic", () => {
    test("returns XLSX for ZIP magic bytes", () => {
      const buf = Buffer.concat([MAGIC_TABLE.XLSX_ZIP, Buffer.from("rest")]);
      expect(detectFormatByMagic(buf)).toBe<DetectedFormat>("XLSX");
    });

    test("returns null for empty buffer", () => {
      expect(detectFormatByMagic(Buffer.alloc(0))).toBeNull();
    });

    test("returns null for plain CSV text", () => {
      const buf = Buffer.from("date,account\n2026-01-01,Cash\n", "utf8");
      expect(detectFormatByMagic(buf)).toBeNull();
    });

    test("returns null for XLS OLE magic — XLS is blocked", () => {
      const buf = Buffer.concat([MAGIC_TABLE.XLS_OLE, Buffer.alloc(8, 0)]);
      expect(detectFormatByMagic(buf)).toBeNull();
    });
  });

  describe("detectStructuredByContent", () => {
    test("returns STRUCTURED for a top-level object", () => {
      expect(detectStructuredByContent(`{"transactions":[]}`)).toBe("STRUCTURED");
    });

    test("returns STRUCTURED for an array of objects", () => {
      expect(detectStructuredByContent(`[{"date":"2026-01-01"}]`)).toBe("STRUCTURED");
    });

    test("returns null for CSV-shaped text", () => {
      expect(detectStructuredByContent("date,account\n2026-01-01,Cash\n")).toBeNull();
    });

    test("returns null for an empty array (ambiguous)", () => {
      expect(detectStructuredByContent("[]")).toBeNull();
    });

    test("returns null for malformed JSON", () => {
      expect(detectStructuredByContent("{not json}")).toBeNull();
    });

    test("tolerates a UTF-8 BOM", () => {
      expect(detectStructuredByContent(`\uFEFF{"x":1}`)).toBe("STRUCTURED");
    });
  });

  describe("detectFormatByExtension", () => {
    test("maps .csv to CSV", () => {
      expect(detectFormatByExtension("ledger.csv")).toBe("CSV");
    });
    test("maps .json to STRUCTURED", () => {
      expect(detectFormatByExtension("data.json")).toBe("STRUCTURED");
    });
    test("maps .xlsx to XLSX", () => {
      expect(detectFormatByExtension("book.xlsx")).toBe("XLSX");
    });
    test("returns null for .xls (blocked)", () => {
      expect(detectFormatByExtension("legacy.xls")).toBeNull();
    });
    test("returns null for unknown extensions", () => {
      expect(detectFormatByExtension("report.pdf")).toBeNull();
    });
  });

  describe("classifySourceByContent", () => {
    test("returns STRUCTURED when text decodes as JSON object", () => {
      expect(classifySourceByContent(Buffer.alloc(1), `{"transactions":[]}`)).toBe("STRUCTURED");
    });
    test("returns null for CSV text", () => {
      expect(classifySourceByContent(Buffer.alloc(1), "date,account\n2026-01-01,Cash\n")).toBeNull();
    });
    test("returns null when no text is provided", () => {
      expect(classifySourceByContent(Buffer.alloc(4))).toBeNull();
    });
  });

  describe("detectSourceFormat — combined", () => {
    test("magic wins over extension when both match (XLSX)", () => {
      const buf = Buffer.concat([MAGIC_TABLE.XLSX_ZIP, Buffer.from("xx")]);
      const result = detectSourceFormat({ sourceName: "book.xlsx", rawBytes: buf });
      expect(result.format).toBe("XLSX");
      expect(result.source).toBe("magic");
    });

    test("magic wins and flags mismatch when extension disagrees", () => {
      const buf = Buffer.concat([MAGIC_TABLE.XLSX_ZIP, Buffer.from("xx")]);
      const result = detectSourceFormat({ sourceName: "book.csv", rawBytes: buf });
      expect(result.format).toBe("XLSX");
      expect(result.source).toBe("magic");
      expect(result.mismatch).toBe(FORMAT_DETECTION_ERROR_CODES.MISMATCH);
    });

    test("falls back to extension when magic unknown", () => {
      const buf = Buffer.from("date,account\n", "utf8");
      const result = detectSourceFormat({ sourceName: "ledger.csv", rawBytes: buf });
      expect(result.format).toBe("CSV");
      expect(result.source).toBe("extension");
    });

    test("falls back to content sniff when both magic and extension unknown", () => {
      const buf = Buffer.from(`{"transactions":[]}`, "utf8");
      const result = detectSourceFormat({
        sourceName: "data",
        rawBytes: buf,
        textContent: `{"transactions":[]}`,
      });
      expect(result.format).toBe("STRUCTURED");
      expect(result.source).toBe("content");
    });

    test("throws UNSUPPORTED when no signal matches", () => {
      const buf = Buffer.from("hello", "utf8");
      expect(() =>
        detectSourceFormat({ sourceName: "blob.bin", rawBytes: buf }),
      ).toThrow(FORMAT_DETECTION_ERROR_CODES.UNSUPPORTED);
    });
  });
});
