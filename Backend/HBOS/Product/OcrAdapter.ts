/**
 * Stage 08-IMG.2 — OCR Acquisition Adapter.
 *
 * Supporting service under the canonical FinancialDataIngestionAdapter.
 * Defines the OcrAdapter contract and the `TesseractOcrAdapter` implementation
 * used for scanned/image-only PDFs and images.
 *
 * Provider: `tesseract.js` (Apache-2.0) behind this contract, admitted in
 * `CapabilityProviderRegistry` as `pdf-ocr-tesseract`. The engine runs fully
 * offline: its WASM core comes from the declared `tesseract.js-core`
 * dependency and its language data is staged locally from the declared
 * `@tesseract.js-data/*` packages, so no runtime CDN/network fetch occurs.
 *
 * The engine is still loaded lazily and fails CLOSED with
 * `ingestion-ocr-unsupported` when the engine or its local language data is
 * unavailable, rather than crashing at module load. Tests and callers may
 * inject an engine explicitly. This module is NOT a new Engine.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const OCR_ERROR_CODES = {
  EMPTY: "ingestion-ocr-empty",
  UNSUPPORTED: "ingestion-ocr-unsupported",
  RECOGNIZE_FAILED: "ingestion-ocr-recognize-failed",
} as const;

/**
 * Canonical OCR provider identity. Declared in package.json as `tesseract.js`
 * (Apache-2.0) and admitted in `CapabilityProviderRegistry` as
 * `pdf-ocr-tesseract`.
 */
export const OCR_PROVIDER_PACKAGE = "tesseract.js";
export const OCR_PROVIDER_ENGINE = "tesseract.js";

/**
 * Language-data packages: MIT-licensed npm packages carrying traineddata
 * derived from the Apache-2.0 `tessdata_fast` data set. Runtime never fetches
 * from a CDN: the `.traineddata.gz` files are read from these already-installed
 * declared dependencies.
 */
export const OCR_LANGUAGE_DATA_PACKAGE_PREFIX = "@tesseract.js-data/";
const OCR_LANGUAGE_DATA_VARIANTS = ["4.0.0_best_int", "4.0.0"] as const;

export interface OcrWord {
  readonly text: string;
  readonly confidence: number;
}

export interface OcrResult {
  readonly sourceName: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly receivedAt: string;
  readonly text: string;
  readonly meanConfidence: number;
  readonly words: ReadonlyArray<OcrWord>;
  readonly engine: string;
  readonly engineVersion: string;
  readonly language: string;
}

export interface OcrEngineData {
  readonly text?: string;
  readonly confidence?: number;
  readonly blocks?: ReadonlyArray<{
    readonly paragraphs?: ReadonlyArray<{
      readonly lines?: ReadonlyArray<{
        readonly words?: ReadonlyArray<{ readonly text?: string; readonly confidence?: number }>;
      }>;
    }>;
  }>;
}

/** Options passed through to the OCR engine (e.g. tesseract.js worker). */
export interface OcrEngineOptions {
  readonly logger?: unknown;
  /** Consumes engine-level errors so the provider does not throw asynchronously. */
  readonly errorHandler?: (error: unknown) => void;
  /** Local directory holding `<lang>.traineddata.gz`; never a remote URL. */
  readonly langPath?: string;
  /** Whether the language data is gzipped. Default true. */
  readonly gzip?: boolean;
  /** tesseract.js cache policy; `none` keeps the run deterministic/offline. */
  readonly cacheMethod?: "none" | "refresh" | "readOnly" | "write";
}

/** Minimal surface the adapter needs from an OCR engine (e.g. tesseract.js). */
export interface OcrEngine {
  readonly version?: string;
  recognize(bytes: Buffer, language: string, options?: OcrEngineOptions): Promise<{ readonly data?: OcrEngineData }>;
}

export interface OcrAdapter {
  readonly engine: string;
  recognize(params: {
    readonly sourceName: string;
    readonly rawBytes: Buffer;
    readonly language?: string;
    readonly receivedAt?: string;
  }): Promise<OcrResult>;
}

export interface TesseractOcrAdapterOptions {
  /** Tesseract language pack to load. Default: "eng". */
  readonly language?: string;
  /** Optional logger override (for tests). */
  readonly logger?: unknown;
  /**
   * Optional pre-resolved OCR engine. When omitted the adapter lazily loads
   * `tesseract.js`; if that module is not installed it fails closed with
   * `ingestion-ocr-unsupported`.
   */
  readonly engine?: OcrEngine;
  /**
   * Local directory holding `<lang>.traineddata.gz`. When omitted and no engine
   * is injected, the adapter resolves the declared `@tesseract.js-data/<lang>`
   * packages and stages them locally, so OCR never performs a runtime network
   * fetch.
   */
  readonly langPath?: string;
  /** Whether language data is gzipped. Default true. */
  readonly gzip?: boolean;
  /** Engine cache policy. Default "none" (deterministic, offline). */
  readonly cacheMethod?: "none" | "refresh" | "readOnly" | "write";
  /** Explicit engine version for provenance when the engine does not advertise one. */
  readonly engineVersion?: string;
  /** Consumes engine-level errors (tesseract.js otherwise throws asynchronously). */
  readonly errorHandler?: (error: unknown) => void;
  /** Override for offline language-data resolution (tests). */
  readonly resolveLanguageData?: OfflineOcrLanguageResolution;
}

/**
 * Resolve the optional `tesseract.js` engine without a static import, so an
 * environment that does not ship OCR never breaks module loading. The `loader`
 * parameter exists so the absent/malformed/present paths can be verified
 * deterministically without installing the dependency.
 *
 * When the loaded module exposes `createWorker` (the real tesseract.js entry),
 * a worker-backed engine is returned that requests BOTH text and word-level
 * blocks, so OCR confidence is derived from real per-word data instead of a
 * fabricated number. A module that does not expose `createWorker` is returned
 * unchanged, which keeps injected/test engines and the fail-closed paths intact.
 */
export const loadTesseractEngine = (loader: (id: string) => unknown = require): OcrEngine => {
  let loaded: unknown;
  try {
    loaded = loader("tesseract.js");
  } catch {
    throw new Error(OCR_ERROR_CODES.UNSUPPORTED);
  }
  const namespace = loaded && typeof loaded === "object" ? (loaded as Record<string, unknown>) : undefined;
  const candidate = namespace && "default" in namespace ? namespace.default : loaded;
  if (!candidate || typeof (candidate as OcrEngine).recognize !== "function") {
    throw new Error(OCR_ERROR_CODES.UNSUPPORTED);
  }
  const module = candidate as OcrEngine & {
    readonly createWorker?: (
      langs: string,
      oem?: number,
      options?: OcrEngineOptions,
    ) => Promise<{
      recognize: (image: Buffer, options?: unknown, output?: unknown) => Promise<{ readonly data?: OcrEngineData }>;
      terminate: () => Promise<unknown>;
    }>;
  };
  if (typeof module.createWorker !== "function") return module;

  const createWorker = module.createWorker.bind(module);
  return {
    version: module.version,
    async recognize(bytes, language, options) {
      const worker = await createWorker(language, 1, options);
      try {
        return await worker.recognize(bytes, undefined, { text: true, blocks: true });
      } finally {
        try {
          await worker.terminate();
        } catch {
          /* best-effort shutdown; never mask the recognition result */
        }
      }
    },
  };
};

export interface OfflineOcrLanguageResolution {
  /** Resolve an installed npm package to its absolute directory. */
  readonly resolvePackageRoot?: (packageId: string) => string | null;
  /** Directory used to stage the combined per-language-set traineddata. */
  readonly stagingDir?: string;
}

const defaultResolvePackageRoot = (packageId: string): string | null => {
  try {
    return dirname(require.resolve(packageId));
  } catch {
    return null;
  }
};

const resolveTrainedDataFile = (
  packageRoot: string,
  code: string,
): string | null => {
  for (const variant of OCR_LANGUAGE_DATA_VARIANTS) {
    const candidate = join(packageRoot, variant, `${code}.traineddata.gz`);
    if (existsSync(candidate) && statSync(candidate).size > 0) return candidate;
  }
  return null;
};

/**
 * Stage the language data the OCR engine needs into ONE local directory.
 *
 * tesseract.js accepts a single `langPath` for every language in a worker, but
 * the language data ships as one npm package per language. This resolves the
 * declared `@tesseract.js-data/<lang>` dependencies, reads their bundled
 * `.traineddata.gz` (never a CDN), and copies them into a deterministic local
 * staging directory. Fails closed with `ingestion-ocr-unsupported` when a
 * required language package is missing, so OCR can never silently fall back to
 * a runtime network fetch.
 */
export function resolveOfflineOcrLangPath(
  language: string,
  options: OfflineOcrLanguageResolution = {},
): string {
  const codes = language
    .split("+")
    .map((code) => code.trim())
    .filter(Boolean);
  if (codes.length === 0) throw new Error(`${OCR_ERROR_CODES.UNSUPPORTED}:language-required`);

  const resolvePackageRoot = options.resolvePackageRoot ?? defaultResolvePackageRoot;
  const stagingDir = options.stagingDir
    ?? join(tmpdir(), `hooshyaros-ocr-${[...codes].sort().join("_")}`);
  mkdirSync(stagingDir, { recursive: true });

  for (const code of codes) {
    const target = join(stagingDir, `${code}.traineddata.gz`);
    if (existsSync(target) && statSync(target).size > 0) continue;

    const packageRoot = resolvePackageRoot(`${OCR_LANGUAGE_DATA_PACKAGE_PREFIX}${code}`);
    if (!packageRoot) {
      throw new Error(`${OCR_ERROR_CODES.UNSUPPORTED}:language-data-package:${code}`);
    }
    const source = resolveTrainedDataFile(packageRoot, code);
    if (!source) {
      throw new Error(`${OCR_ERROR_CODES.UNSUPPORTED}:language-data-file:${code}`);
    }
    const staging = `${target}.${process.pid}.tmp`;
    copyFileSync(source, staging);
    renameSync(staging, target);
  }

  return stagingDir;
};

/** Installed OCR engine version, for truthful provenance (never fabricated). */
export const resolveOcrEngineVersion = (loader: (id: string) => unknown = require): string => {
  try {
    const pkg = loader(`${OCR_PROVIDER_PACKAGE}/package.json`) as { readonly version?: string } | undefined;
    return pkg?.version?.trim() || "unknown";
  } catch {
    return "unknown";
  }
};

export class TesseractOcrAdapter implements OcrAdapter {
  readonly engine = OCR_PROVIDER_ENGINE;
  private readonly language: string;
  private readonly logger: unknown;
  private readonly injectedEngine?: OcrEngine;
  private readonly langPath?: string;
  private readonly gzip: boolean;
  private readonly cacheMethod: "none" | "refresh" | "readOnly" | "write";
  private readonly engineVersionOverride?: string;
  private readonly errorHandler: (error: unknown) => void;
  private readonly resolveLanguageData: OfflineOcrLanguageResolution;

  constructor(options: TesseractOcrAdapterOptions = {}) {
    this.language = options.language ?? "eng";
    // tesseract.js calls the logger on every progress event, so a no-op
    // function is required when the caller does not supply one.
    this.logger = options.logger ?? (() => {});
    this.injectedEngine = options.engine;
    this.langPath = options.langPath;
    this.gzip = options.gzip ?? true;
    this.cacheMethod = options.cacheMethod ?? "none";
    this.engineVersionOverride = options.engineVersion;
    this.errorHandler = options.errorHandler ?? (() => {});
    this.resolveLanguageData = options.resolveLanguageData ?? {};
  }

  async recognize(params: {
    readonly sourceName: string;
    readonly rawBytes: Buffer;
    readonly language?: string;
    readonly receivedAt?: string;
  }): Promise<OcrResult> {
    if (!Buffer.isBuffer(params.rawBytes) || params.rawBytes.length === 0) {
      throw new Error(OCR_ERROR_CODES.EMPTY);
    }
    const language = params.language ?? this.language;
    const sha256 = createHash("sha256").update(params.rawBytes).digest("hex");
    const receivedAt = params.receivedAt ?? new Date().toISOString();

    // Resolve the engine BEFORE the recognition try/catch so an absent
    // dependency fails closed with `ingestion-ocr-unsupported` instead of
    // being reported as a recognition failure.
    const engine = this.injectedEngine ?? loadTesseractEngine();

    // Local language data only: an injected engine passes its own options;
    // otherwise the declared offline language-data packages are staged. A
    // missing package fails closed rather than fetching from a CDN.
    let engineOptions: OcrEngineOptions = { logger: this.logger, errorHandler: this.errorHandler };
    if (!this.injectedEngine || this.langPath) {
      const langPath = this.langPath ?? resolveOfflineOcrLangPath(language, this.resolveLanguageData);
      engineOptions = {
        logger: this.logger,
        errorHandler: this.errorHandler,
        langPath,
        gzip: this.gzip,
        cacheMethod: this.cacheMethod,
      };
    }

    let result: { readonly data?: OcrEngineData };
    try {
      result = await engine.recognize(params.rawBytes, language, engineOptions);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      throw new Error(`${OCR_ERROR_CODES.RECOGNIZE_FAILED}:${msg}`);
    }

    const data = result.data ?? {};
    const text = data.text ?? "";
    const words: OcrWord[] = [];
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs ?? []) {
        for (const line of para.lines ?? []) {
          for (const w of line.words ?? []) {
            words.push({
              text: w.text ?? "",
              confidence: typeof w.confidence === "number" ? w.confidence : 0,
            });
          }
        }
      }
    }
    const meanConfidence = words.length
      ? words.reduce((sum, w) => sum + w.confidence, 0) / words.length
      : (typeof data.confidence === "number" && Number.isFinite(data.confidence) ? data.confidence : 0);

    return {
      sourceName: params.sourceName.trim(),
      sha256,
      byteLength: params.rawBytes.length,
      receivedAt,
      text,
      meanConfidence,
      words,
      engine: this.engine,
      engineVersion: engine.version ?? this.engineVersionOverride ?? "unknown",
      language,
    };
  }
}

/**
 * Canonical, offline-first OCR adapter used by the commercial ingestion path.
 * Language data resolves to the declared `@tesseract.js-data/*` packages; the
 * default language set is Persian + English.
 */
export function createCanonicalOcrAdapter(options: {
  readonly language?: string;
  readonly logger?: unknown;
} = {}): OcrAdapter {
  return new TesseractOcrAdapter({
    language: options.language ?? "fas+eng",
    logger: options.logger,
    engineVersion: resolveOcrEngineVersion(),
  });
}
