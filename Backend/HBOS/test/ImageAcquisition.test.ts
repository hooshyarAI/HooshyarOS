/**
 * Stage 08-IMG.1 — Raw Image Acquisition focused tests.
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  acquireImage,
  detectImageFormat,
  detectImageFormatByExtension,
  IMAGE_ERROR_CODES,
  type ImageSource,
} from "../Product/ImageAcquisition";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { FinancialDataIngestionAdapter } from "../Product/FinancialDataIngestionAdapter";

describe("ImageAcquisition (Stage 08-IMG.1)", () => {
  describe("detectImageFormat (magic)", () => {
    test("detects PNG magic", () => {
      const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
      expect(detectImageFormat(buf)).toBe("PNG");
    });
    test("detects JPEG magic", () => {
      const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      expect(detectImageFormat(buf)).toBe("JPEG");
    });
    test("returns null for empty buffer", () => {
      expect(detectImageFormat(Buffer.alloc(0))).toBeNull();
    });
    test("returns null for unrelated bytes", () => {
      expect(detectImageFormat(Buffer.from("hello world"))).toBeNull();
    });
  });

  describe("detectImageFormatByExtension", () => {
    test("maps .png", () => {
      expect(detectImageFormatByExtension("a.png")).toBe("PNG");
    });
    test("maps .jpg and .jpeg", () => {
      expect(detectImageFormatByExtension("a.jpg")).toBe("JPEG");
      expect(detectImageFormatByExtension("a.jpeg")).toBe("JPEG");
    });
    test("returns null for unrelated extensions", () => {
      expect(detectImageFormatByExtension("a.gif")).toBeNull();
    });
  });

  describe("acquireImage", () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

    test("acquires a valid PNG", () => {
      const bytes = Buffer.concat([pngHeader, Buffer.alloc(64, 0xaa)]);
      const img: ImageSource = acquireImage({ sourceName: "scan.png", rawBytes: bytes });
      expect(img.format).toBe("PNG");
      expect(img.mediaType).toBe("image/png");
      expect(img.byteLength).toBe(bytes.length);
      expect(img.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    });

    test("acquires a valid JPEG", () => {
      const bytes = Buffer.concat([jpegHeader, Buffer.alloc(64, 0xbb)]);
      const img = acquireImage({ sourceName: "scan.jpg", rawBytes: bytes });
      expect(img.format).toBe("JPEG");
      expect(img.mediaType).toBe("image/jpeg");
    });

    test("rejects on empty buffer", () => {
      expect(() => acquireImage({ sourceName: "x.png", rawBytes: Buffer.alloc(0) }))
        .toThrow(IMAGE_ERROR_CODES.EMPTY);
    });

    test("rejects when too large (10 MB default)", () => {
      const bytes = Buffer.concat([pngHeader, Buffer.alloc(11 * 1024 * 1024, 0xaa)]);
      expect(() => acquireImage({ sourceName: "big.png", rawBytes: bytes }))
        .toThrow(IMAGE_ERROR_CODES.TOO_LARGE);
    });

    test("rejects mismatch (PNG bytes with .jpg extension)", () => {
      const bytes = Buffer.concat([pngHeader, Buffer.alloc(16, 0xaa)]);
      expect(() => acquireImage({ sourceName: "wrong.jpg", rawBytes: bytes }))
        .toThrow(IMAGE_ERROR_CODES.MISMATCH);
    });

    test("rejects non-image magic bytes", () => {
      const bytes = Buffer.from("not really an image");
      expect(() => acquireImage({ sourceName: "x.png", rawBytes: bytes }))
        .toThrow(IMAGE_ERROR_CODES.UNSUPPORTED);
    });
  });

  describe("FinancialDataIngestionAdapter.ingestImage", () => {
    let directory: string;
    let store: SQLitePersistenceStore;
    let adapter: FinancialDataIngestionAdapter;

    beforeEach(() => {
      directory = mkdtempSync(join(tmpdir(), "hooshyar-img-"));
      store = new SQLitePersistenceStore({ databasePath: join(directory, "s.db") });
      adapter = new FinancialDataIngestionAdapter(store);
    });

    afterEach(() => {
      try { store.close(); } catch {}
      try { rmSync(directory, { recursive: true, force: true }); } catch {}
    });

    test("ingestImage returns ImageSource with SHA-256 + mediaType", async () => {
      const png = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(32, 0xab),
      ]);
      const p = join(directory, "scan.png");
      writeFileSync(p, png);
      const img = await adapter.ingestImage(p);
      expect(img.format).toBe("PNG");
      expect(img.mediaType).toBe("image/png");
      expect(img.sha256).toHaveLength(64);
    });

    test("ingestFile routes .png to OCR-required signal (no fake transactions)", async () => {
      const png = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(32, 0xab),
      ]);
      const p = join(directory, "scan.png");
      writeFileSync(p, png);
      await expect(adapter.ingestFile("t1", p))
        .rejects.toThrow(/ingestion-image-requires-ocr/);
    });
  });
});
