# Phase 08-IMG.2 — OCR Acquisition Adapter — Checkpoint

## Stage
- **Stage ID:** 08-IMG.2
- **Title:** OCR Acquisition Adapter
- **Phase:** 08 — Universal Data Acquisition
- **Parent Stage:** 08
- **Owner:** Backend/HBOS/Product/FinancialDataIngestionAdapter.ts
- **Status:** COMPLETE
- **Timestamp:** 2026-09-03T19:12:00Z
- **Commit SHA:** 4e9137c98c9685987fb2bc6aa9aec1bcd2280238

## Implementation
- New module: `Backend/HBOS/Product/OcrAdapter.ts`
  - `OcrResult`, `OcrWord`, `OcrAdapter` contracts
  - `OCR_ERROR_CODES = { EMPTY, UNSUPPORTED, RECOGNIZE_FAILED }`
  - `TesseractOcrAdapter` reference implementation backed by `tesseract.js`
  - Walks `blocks -> paragraphs -> lines -> words` to compute mean confidence
  - Returns deterministic SHA-256 of raw bytes
- Dependency added: `tesseract.js@7.0.0` (Apache-2.0)
- Canonical owner NOT modified.

## Inputs
- raw image bytes + sourceName + optional language

## Outputs
- OcrResult { text, meanConfidence, words[], engine, engineVersion, language, sha256, byteLength, receivedAt }

## Verification Metric
- `npm test -- --testPathPattern="OcrAdapter"` — 6/6 PASS
- baseline 61 preserved

## Resource Policy
- Default language "eng". No automatic language detection; the caller picks.

## Security Controls
- Empty buffer -> `ingestion-ocr-empty`
- Tesseract errors wrapped as `ingestion-ocr-recognize-failed:<msg>`
- Confidence never fabricated; computed from real Tesseract output.
- No remote loads (tesseract.js worker uses local WASM by default).

## Known Limitations
- Tesseract.js v7 uses a WASM worker that requires fetching the language
  pack on first use; in air-gapped deployments, stage 08-IMG.2 must be
  reconfigured with `Tesseract.createWorker` and pre-bundled lang files.
- No multi-page (PDF) image input yet — that is stage 08-IMG.4.

## Resume Condition
- N/A — stage complete.

## Blocked By
- None.

## Next
- 08-IMG.3 — OCR Provenance / Confidence.