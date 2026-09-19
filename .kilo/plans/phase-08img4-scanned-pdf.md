# Phase 08-IMG.4 — Scanned-PDF -> OCR Routing — Checkpoint

## Stage
- **Stage ID:** 08-IMG.4
- **Title:** Scanned-PDF -> OCR Routing
- **Phase:** 08 — Universal Data Acquisition
- **Parent Stage:** 08
- **Owner:** Backend/HBOS/Product/FinancialDataIngestionAdapter.ts
- **Status:** COMPLETE
- **Timestamp:** 2026-09-03T19:22:00Z
- **Commit SHA:** a26dfb80d335006d1db4f90f81d2608da68f50fc

## Implementation
- New module: `Backend/HBOS/Product/ScannedPdfRouter.ts`
  - `decideScannedPages(pdf, threshold)` -> per-page decisions
  - `routeScannedPdfToOcr(pdf, ocr, options)` -> `ScannedRoutingResult`
  - `SCANNED_ROUTING_ERROR_CODES = { PAGE_BUDGET_INVALID }`
  - Per-page time budget via `Promise.race` + `setTimeout`
  - `rasterizePage` is a caller-supplied hook (no PDF renderer embedded
    here to keep the module decoupled from a concrete renderer)
- Canonical owner NOT modified.

## Inputs
- PdfTextDocument from 08-DOC.2
- OcrAdapter from 08-IMG.2
- textNativeCharsPerPage, perPageOcrTimeoutMs, language options

## Outputs
- ScannedRoutingResult { decisions, ocrResults, anyRoutedToOcr }

## Verification Metric
- `npm test -- --testPathPattern="ScannedPdfRouter"` — 5/5 PASS
- baseline 61 preserved

## Resource Policy
- Per-page timeout default 30s; configurable.
- Threshold default 50 chars/page (matches 08-DOC.2).

## Security Controls
- Per-page timeout prevents a single slow OCR call from hanging the pipeline.
- Negative threshold rejected.
- OcrAdapter failures are propagated (no silent swallow).

## Known Limitations
- `rasterizePage` is a hook; a concrete pdf.js-based rasterizer is
  intentionally out of scope for this stage.

## Resume Condition
- N/A — stage complete.

## Blocked By
- None.

## Next
- 08-AUTO.1 — Local Folder Watcher (fs.watch).