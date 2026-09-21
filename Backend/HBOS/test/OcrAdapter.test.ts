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
import { createHash } from "node:crypto";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import {
  OCR_ERROR_CODES,
  OCR_PROVIDER_ENGINE,
  TesseractOcrAdapter,
  createCanonicalOcrAdapter,
  loadTesseractEngine,
  resolveOcrEngineVersion,
  resolveOfflineOcrLangPath,
  type OcrEngine,
  type OcrEngineOptions,
} from "../Product/OcrAdapter";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const nodeRequire = createRequire(join(REPO_ROOT, "package.json"));

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

    test("recognize fails closed with a real recognition error on an unreadable image (no fake text)", async () => {
      // The OCR provider is admitted and installed, so the honest fail-closed
      // boundary is now a real recognition failure — never fabricated text.
      const adapter = new TesseractOcrAdapter();
      await expect(adapter.recognize({ sourceName: "x.png", rawBytes: Buffer.from("not an image") }))
        .rejects.toThrow(/ingestion-ocr-recognize-failed/);
    });
  });

  describe("offline language data (declared local packages, no runtime fetch)", () => {
    test("stages the declared language data as a local directory for a single language", () => {
      const stagingDir = mkdtempSync(join(tmpdir(), "ocr-eng-"));
      const langPath = resolveOfflineOcrLangPath("eng", { stagingDir });
      expect(langPath).toBe(stagingDir);
      expect(existsSync(join(langPath, "eng.traineddata.gz"))).toBe(true);
      expect(langPath).not.toMatch(/^https?:/);
    });

    test("stages Persian and English together for the canonical fas+eng set", () => {
      const stagingDir = mkdtempSync(join(tmpdir(), "ocr-faseng-"));
      const langPath = resolveOfflineOcrLangPath("fas+eng", { stagingDir });
      expect(existsSync(join(langPath, "eng.traineddata.gz"))).toBe(true);
      expect(existsSync(join(langPath, "fas.traineddata.gz"))).toBe(true);
    });

    test("fails closed when the language-data package is not installed", () => {
      const stagingDir = mkdtempSync(join(tmpdir(), "ocr-missing-"));
      expect(() => resolveOfflineOcrLangPath("eng", { stagingDir, resolvePackageRoot: () => null }))
        .toThrow(/ingestion-ocr-unsupported/);
    });

    test("fails closed when the package exists but carries no traineddata variant", () => {
      const stagingDir = mkdtempSync(join(tmpdir(), "ocr-empty-"));
      const emptyRoot = mkdtempSync(join(tmpdir(), "ocr-root-"));
      expect(() => resolveOfflineOcrLangPath("eng", { stagingDir, resolvePackageRoot: () => emptyRoot }))
        .toThrow(/ingestion-ocr-unsupported/);
    });

    test("reports the installed engine version for truthful provenance", () => {
      expect(resolveOcrEngineVersion()).toMatch(/^\d+\.\d+\.\d+/);
      const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "node_modules", "tesseract.js", "package.json"), "utf8")) as { version?: string; license?: string };
      expect(pkg.license).toBe("Apache-2.0");
      expect(resolveOcrEngineVersion()).toBe(pkg.version);
    });
  });

  describe("canonical offline adapter (real engine, real language data)", () => {
    test("recognizes a real ledger image end-to-end with truthful provenance", async () => {
      const canvas = nodeRequire("@napi-rs/canvas").createCanvas(900, 260);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 900, 260);
      ctx.fillStyle = "#000000";
      ctx.font = "30px sans-serif";
      ctx.fillText("date,account,debit,credit,currency", 15, 55);
      ctx.fillText("2026-08-01,Cash,1000,0,IRR", 15, 100);
      ctx.fillText("2026-08-02,Receivable,250,0,IRR", 15, 145);
      const png = canvas.toBuffer("image/png");

      const adapter = createCanonicalOcrAdapter();
      expect(adapter.engine).toBe(OCR_PROVIDER_ENGINE);
      const result = await adapter.recognize({ sourceName: "scan.png", rawBytes: png, language: "fas+eng" });

      expect(result.text).toContain("2026-08-01,Cash,1000,0,IRR");
      expect(result.meanConfidence).toBeGreaterThan(0);
      expect(result.engine).toBe(OCR_PROVIDER_ENGINE);
      expect(result.engineVersion).toMatch(/^\d+\.\d+\.\d+/);
      expect(result.language).toBe("fas+eng");
      expect(result.sha256).toBe(createHash("sha256").update(png).digest("hex"));
    }, 120000);

    test("does not fabricate text for a text-free image", async () => {
      const canvas = nodeRequire("@napi-rs/canvas").createCanvas(200, 100);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 200, 100);
      const png = canvas.toBuffer("image/png");
      const result = await createCanonicalOcrAdapter().recognize({ sourceName: "blank.png", rawBytes: png });
      expect(result.text.trim()).toBe("");
    }, 120000);

    test("passes only local, network-free options to the engine", async () => {
      const calls: OcrEngineOptions[] = [];
      const engine: OcrEngine = {
        version: "test",
        recognize: async (_bytes, _language, options) => {
          calls.push(options ?? {});
          return { data: { text: "ok" } };
        },
      };
      const adapter = new TesseractOcrAdapter({ engine, langPath: "/local/tessdata" });
      await adapter.recognize({ sourceName: "a.png", rawBytes: Buffer.from([1]) });
      expect(calls).toHaveLength(1);
      expect(calls[0].langPath).toBe("/local/tessdata");
      expect(calls[0].cacheMethod).toBe("none");
      expect(calls[0].gzip).toBe(true);
      expect(String(calls[0].langPath)).not.toMatch(/^https?:/);
    });

    test("performs no network fetch during a real OCR run", async () => {
      const canvas = nodeRequire("@napi-rs/canvas").createCanvas(900, 260);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 900, 260);
      ctx.fillStyle = "#000000";
      ctx.font = "30px sans-serif";
      ctx.fillText("date,account,debit,credit,currency", 15, 55);
      ctx.fillText("2026-08-01,Cash,1000,0,IRR", 15, 100);
      const png = canvas.toBuffer("image/png");

      const originalFetch = (globalThis as { fetch?: unknown }).fetch;
      const fetchSpy = jest.fn(() => { throw new Error("network access attempted"); });
      (globalThis as { fetch?: unknown }).fetch = fetchSpy;
      try {
        const result = await createCanonicalOcrAdapter().recognize({ sourceName: "offline.png", rawBytes: png });
        expect(result.text).toContain("2026-08-01,Cash,1000,0,IRR");
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        (globalThis as { fetch?: unknown }).fetch = originalFetch;
      }
    }, 120000);
  });
});
