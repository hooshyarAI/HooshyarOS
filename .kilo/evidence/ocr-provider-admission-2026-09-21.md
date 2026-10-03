# OCR Provider Admission Evidence — `pdf-ocr-tesseract` (2026-09-21)

**Status:** ADMITTED / INTEGRATED — all prior `unmetConditions` for the OCR
capability are satisfied by repository-verifiable evidence.
**Capability:** `document.pdf.ocr` (scanned / image-only PDF → text)
**Inventory owner:** `Backend/HBOS/Product/CapabilityProviderRegistry.ts`
**Governing law:** `Docs/HOOSHYAROS_CAPABILITY_PROVIDER_LEVERAGE_LAW.md`
**Branch:** `fix/autonomous-product-factory`

## 1. Reuse-tier decision (canonical order)

| Tier | Evaluation | Outcome |
|---|---|---|
| INDUSTRY_STANDARD | Tesseract is the de-facto open OCR engine; `tesseract.js` is its maintained WASM/JS port | selected |
| MATURE_LIBRARY | `tesseract.js` 7.0.0 + `tesseract.js-core` 7.0.0, Apache-2.0 | **ADMITTED** |
| INTERNAL_CAPABILITY | Not suitable — OCR is a commodity ML/vision capability, not a HooshyarOS differentiator | not used |
| ADAPTER_PROVIDER | The provider sits behind the existing `OcrAdapter` boundary | used as the boundary |
| NATIVE_IMPLEMENTATION | Rejected — no reason to build an OCR engine | not used |

No new engine, registry or parallel OCR architecture was introduced. The
provider is consumed only through the pre-existing
`CapabilityProviderRegistry → OcrAdapter → ScannedPdfRouter → canonical
ingestion` path.

## 2. License verification (authoritative, in-repo)

| Component | Installed version | License (authoritative source) |
|---|---|---|
| `tesseract.js` | 7.0.0 | Apache-2.0 — `node_modules/tesseract.js/package.json#license` |
| `tesseract.js-core` | 7.0.0 | Apache-2.0 — `node_modules/tesseract.js-core/package.json#license` |
| `@tesseract.js-data/eng` | 1.0.0 | MIT — `node_modules/@tesseract.js-data/eng/package.json#license` (data derived from Apache-2.0 `tessdata_fast`) |
| `@tesseract.js-data/fas` | 1.0.0 | MIT — `node_modules/@tesseract.js-data/fas/package.json#license` (data derived from Apache-2.0 `tessdata_fast`) |

- Upstream `tesseract-ocr/tessdata_fast` `LICENSE` was fetched from the
  authoritative raw GitHub source (`https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/LICENSE`)
  and is the Apache License, Version 2.0.
- Both licenses permit commercial use, modification, self-hosting and
  redistribution. No paid, proprietary or mandatory-cloud component is involved.
- The WASM core is loaded from the declared `tesseract.js-core` dependency
  (`worker-script/node/getCore.js` requires it directly); no runtime download.

## 3. Offline / self-hosted / no-runtime-network verification

- The adapter resolves language data through
  `resolveOfflineOcrLangPath()` (`Product/OcrAdapter.ts`), which reads the
  installed `@tesseract.js-data/<lang>` package's bundled
  `<lang>.traineddata.gz`, stages it into a local directory and passes that
  **local absolute path** as `langPath`.
- `cacheMethod: "none"` disables the engine's cache read/write; `gzip: true`
  matches the packaged `.gz` data. Because `langPath` is a local filesystem path
  (never a URL), `tesseract.js` never reaches its jsdelivr CDN default.
- **Measured evidence:** `Backend/HBOS/test/OcrAdapter.test.ts` includes
  *"performs no network fetch during a real OCR run"*, which replaces
  `globalThis.fetch` with a throwing spy and still completes real OCR
  successfully. A `langPath`/`cacheMethod` option assertion test additionally
  proves only local, network-free options are passed to the engine.
- Fails closed with `ingestion-ocr-unsupported` if a language-data package is
  missing, so a missing dependency can never silently become a CDN fetch.

## 4. Persian + English language data

- Default commercial language set: `fas+eng` (`DEFAULT_OCR_LANGUAGE`).
- `resolveOfflineOcrLangPath("fas+eng")` stages both `fas.traineddata.gz` and
  `eng.traineddata.gz` and is asserted by tests.

## 5. Resource / security bounds

- `PdfPageRasterizer` bounds page count (default 200) and per-page byte size
  (default 25 MB) before any OCR call.
- `ScannedPdfRouter` bounds per-page OCR time (default 30 s) via `AbortController`/timeout race.
- The engine runs in-process (WASM) with no network and no code execution; the
  one worker per recognition call is terminated in a `finally` block, so no
  worker/handle accumulates.
- OCR text is normalized through the same canonical validation pipeline as
  native text and cannot bypass it.

## 6. Provenance

- The canonical model's `source.sha256` remains the **ORIGINAL PDF-byte** hash.
- `source.ocr` records `ocrEngine`, `ocrEngineVersion` (real installed version,
  e.g. `7.0.0`), `ocrConfidence` (measured mean of real per-word confidences, or
  `null` when unknown — never fabricated) and `ocrLanguage`.

## 7. End-to-end evidence (real runtime)

- `Backend/HBOS/test/PdfIngestionRuntime.test.ts` — real `tesseract.js` engine +
  real local language data recognizes a canvas-rendered scanned page and yields
  4 canonical transactions with OCR provenance.
- `scripts/pdf-ingestion-acceptance.ts` (real Node/tsx, real HTTP runtime) —
  PASS with `scannedPdfOcrSupported: true`, `ocrClaimed: true`,
  `scannedTransactionCount: 4`, `scannedConfidence > 0`, and a text-free scan
  failing closed with `ingestion-ocr-empty`.
- `scripts/web-product-acceptance.cjs` — the scanned PDF is OCR'd through the
  real HTTP runtime; a blank scan fails closed precisely.

## 8. Fail-closed behaviour preserved

- If `document.pdf.ocr` is not admitted, `FinancialIngestionService` does not
  attempt OCR and scanned PDFs keep the precise
  `ingestion-pdf-scanned-no-ocr-yet` limitation.
- If OCR runs but produces no text, the request fails closed with
  `ingestion-ocr-empty`. No OCR result is ever faked.
- Text-native PDFs continue to use the accepted `ingestPdfBytes` route
  unchanged.

## 9. Truth boundary

This record claims only what the listed tests and acceptance scripts measure. It
does not claim unlimited OCR accuracy, does not claim support for image formats
other than those already admitted, and does not alter any completion flag.
