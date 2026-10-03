/**
 * Stage 08-IMG.5 — PDF Page Rasterizer Provider (supporting service).
 *
 * A real, self-hosted rasterization boundary: it renders individual PDF pages
 * to PNG bytes so scanned/image-only PDF pages can be handed to the OCR adapter
 * (`Product/OcrAdapter.ts`) without the OCR engine ever owning PDF parsing.
 *
 * This module is NOT a new Engine and NOT a second PDF architecture. It reuses
 * the already-admitted `pdf-parse` dependency (which renders through its bundled
 * `pdfjs-dist` + `@napi-rs/canvas` stack), and exposes the replaceable provider
 * boundary recorded in `CapabilityProviderRegistry` as
 * `pdf-rasterize-pdfparse`. No OCR is performed here.
 *
 * Security: the parser is treated as an untrusted-input processor. Page count
 * and per-page byte size are bounded, parsing errors fail closed, and the single
 * worker-backed parser instance is accessed sequentially (never concurrently).
 */
import { PDFParse } from "pdf-parse";
import { detectPdfMagic } from "./PdfAcquisition";

export const PDF_RASTERIZER_ERROR_CODES = {
  EMPTY: "ingestion-pdf-rasterize-empty",
  UNSUPPORTED: "ingestion-pdf-rasterize-unsupported",
  TOO_MANY_PAGES: "ingestion-pdf-rasterize-too-many-pages",
  PAGE_TOO_LARGE: "ingestion-pdf-rasterize-page-too-large",
  PAGE_OUT_OF_RANGE: "ingestion-pdf-rasterize-page-out-of-range",
  FAILED: "ingestion-pdf-rasterize-failed",
} as const;

/** Provider identity recorded in OCR provenance and the provider inventory. */
export const PDF_RASTERIZER_PROVIDER = "pdf-parse (pdfjs-dist + @napi-rs/canvas)";

export interface RasterizedPdfPage {
  readonly pageNumber: number;
  readonly data: Buffer;
  readonly width: number;
  readonly height: number;
}

export interface RasterizePdfOptions {
  readonly rawBytes: Buffer;
  /** Render scale; ignored when `desiredWidth` is set. Default 2. */
  readonly scale?: number;
  /** Optional target width in pixels. */
  readonly desiredWidth?: number;
  /** Maximum pages rendered in one pass. Default 200. */
  readonly maxPages?: number;
  /** Maximum bytes per rendered page. Default 25 MB. */
  readonly maxPageBytes?: number;
}

export interface PdfPageRasterizer {
  readonly provider: string;
  /** Render every requested page once and reuse the result. */
  rasterizeAll(): Promise<ReadonlyArray<RasterizedPdfPage>>;
  /** Render a single 1-based page (used by ScannedPdfRouter). */
  rasterizePage(pageNumber: number): Promise<Buffer>;
  destroy(): Promise<void>;
}

interface ScreenshotLike {
  readonly data?: Uint8Array;
  readonly width?: number;
  readonly height?: number;
}

interface ParserLike {
  getScreenshot(params?: Record<string, unknown>): Promise<{ readonly pages?: ReadonlyArray<ScreenshotLike> }>;
  destroy(): Promise<void>;
}

export type PdfParserFactory = (data: Uint8Array) => ParserLike;

const defaultParserFactory: PdfParserFactory = (data) =>
  new PDFParse({ data }) as unknown as ParserLike;

/**
 * Create a rasterizer bound to one PDF document. The parser is only created
 * lazily on first use so an unused rasterizer never touches the engine.
 */
export function createPdfPageRasterizer(
  options: RasterizePdfOptions,
  createParser: PdfParserFactory = defaultParserFactory,
): PdfPageRasterizer {
  const { rawBytes } = options;
  if (!Buffer.isBuffer(rawBytes) || rawBytes.length === 0) {
    throw new Error(PDF_RASTERIZER_ERROR_CODES.EMPTY);
  }
  if (!detectPdfMagic(rawBytes)) {
    throw new Error(PDF_RASTERIZER_ERROR_CODES.UNSUPPORTED);
  }

  const maxPages = options.maxPages ?? 200;
  const maxPageBytes = options.maxPageBytes ?? 25 * 1024 * 1024;

  let parser: ParserLike | null = null;
  let cache: RasterizedPdfPage[] | null = null;

  const renderAll = async (): Promise<RasterizedPdfPage[]> => {
    if (cache) return cache;
    if (!parser) parser = createParser(new Uint8Array(rawBytes));
    let result: { readonly pages?: ReadonlyArray<ScreenshotLike> };
    try {
      result = await parser.getScreenshot({
        imageBuffer: true,
        ...(options.desiredWidth ? { desiredWidth: options.desiredWidth } : { scale: options.scale ?? 2 }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      throw new Error(`${PDF_RASTERIZER_ERROR_CODES.FAILED}:${message}`);
    }
    const pages = result.pages ?? [];
    if (pages.length > maxPages) {
      throw new Error(PDF_RASTERIZER_ERROR_CODES.TOO_MANY_PAGES);
    }
    const rendered: RasterizedPdfPage[] = [];
    for (let i = 0; i < pages.length; i += 1) {
      const page = pages[i];
      if (!page?.data || page.data.length === 0) {
        throw new Error(`${PDF_RASTERIZER_ERROR_CODES.FAILED}:page-${i + 1}-no-image`);
      }
      if (page.data.length > maxPageBytes) {
        throw new Error(PDF_RASTERIZER_ERROR_CODES.PAGE_TOO_LARGE);
      }
      rendered.push({
        pageNumber: i + 1,
        data: Buffer.from(page.data),
        width: page.width ?? 0,
        height: page.height ?? 0,
      });
    }
    if (rendered.length === 0) {
      throw new Error(`${PDF_RASTERIZER_ERROR_CODES.FAILED}:no-pages`);
    }
    cache = rendered;
    return rendered;
  };

  return {
    provider: PDF_RASTERIZER_PROVIDER,
    rasterizeAll: renderAll,
    async rasterizePage(pageNumber: number): Promise<Buffer> {
      if (!Number.isInteger(pageNumber) || pageNumber < 1) {
        throw new Error(PDF_RASTERIZER_ERROR_CODES.PAGE_OUT_OF_RANGE);
      }
      const pages = await renderAll();
      const page = pages.find((p) => p.pageNumber === pageNumber);
      if (!page) throw new Error(PDF_RASTERIZER_ERROR_CODES.PAGE_OUT_OF_RANGE);
      return page.data;
    },
    async destroy(): Promise<void> {
      cache = null;
      if (parser) {
        const current = parser;
        parser = null;
        try {
          await current.destroy();
        } catch {
          /* best-effort shutdown; never mask the original failure */
        }
      }
    },
  };
}
