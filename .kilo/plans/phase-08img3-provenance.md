# Phase 08-IMG.3 — OCR Provenance / Confidence — Checkpoint

## Stage
- **Stage ID:** 08-IMG.3
- **Title:** OCR Provenance / Confidence
- **Phase:** 08 — Universal Data Acquisition
- **Parent Stage:** 08
- **Owner:** Backend/HBOS/Product/FinancialDataIngestionAdapter.ts
- **Status:** COMPLETE
- **Timestamp:** 2026-09-03T19:16:00Z
- **Commit SHA:** b37f64bdebcd373fcf144003586890524de9edc3

## Implementation
- New module: `Backend/HBOS/Product/OcrProvenance.ts`
  - `OcrProvenance` sub-record { ocrEngine, ocrEngineVersion, ocrExtractedAt, ocrConfidence, ocrLanguage }
  - `createOcrProvenance(params)` validates engine/version/language non-empty
    and confidence in [0,100] or null
  - `withOcrProvenance(base, ocr)` returns a new typed record with `ocr` attached
  - `OCR_PROVENANCE_ERROR_CODES = { INVALID_CONFIDENCE, INVALID_ENGINE, INVALID_TIMESTAMP }`
- Canonical owner NOT modified.

## Inputs
- engine name, version, optional extractedAt, nullable confidence, language

## Outputs
- OcrProvenance (immutable)

## Verification Metric
- `npm test -- --testPathPattern="OcrProvenance"` — 9/9 PASS
- baseline 61 preserved

## Resource Policy
- None.

## Security Controls
- Confidence never silently fabricated. Null is the explicit "unknown" value.
- Confidence must be finite, in [0,100].
- Engine/version/language non-empty enforced.

## Known Limitations
- Provenance is attached at the evidence layer; downstream
  FinancialCanonicalModel is unchanged for this stage. Future stage can
  widen the canonical model to include OcrProvenance directly.

## Resume Condition
- N/A — stage complete.

## Blocked By
- None.

## Next
- 08-IMG.4 — Scanned-PDF -> OCR routing.