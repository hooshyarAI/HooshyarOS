# Phase 08-DOC.4 — Document Table Extraction / Normalization — Checkpoint

## Stage
- **Stage ID:** 08-DOC.4
- **Title:** Document Table Extraction / Normalization
- **Phase:** 08 — Universal Data Acquisition
- **Parent Stage:** 08
- **Owner:** Backend/HBOS/Product/FinancialDataIngestionAdapter.ts
- **Status:** COMPLETE
- **Timestamp:** 2026-09-03T19:05:00Z
- **Commit SHA:** 65de0517c8e0f523d5a52929c0e7cca2bfc5a0fa

## Implementation
- New module: `Backend/HBOS/Product/DocumentTableExtractor.ts`
  - `detectTables(text)` -> `TableCandidate[]`
  - `mapTableToCanonical(table, expected)` -> `MappedTransaction[]`
  - `CANONICAL_FINANCIAL_SCHEMA` constant
  - `TABLE_ERROR_CODES = { AMBIGUOUS, SCHEMA_INVALID }`
  - Detects pipe-, tab-, and 2+-space-delimited blocks
  - Header-alias matching (Date/Tx Date, Account/Description, Dr/Withdrawal, etc.)
  - Accepts any column order; throws AMBIGUOUS when required headers missing
- Canonical owner NOT modified.

## Inputs
- text (string) extracted from PDF/DOCX route

## Outputs
- TableCandidate[] -> MappedTransaction[]

## Verification Metric
- `npm test -- --testPathPattern="DocumentTableExtractor"` — 10/10 PASS
- baseline 61 preserved

## Resource Policy
- Pure functions, no I/O, no external deps.

## Security Controls
- All data is treated as untrusted text.
- No regex DoS vectors; all regexes are linear.

## Known Limitations
- The space-aligned detector requires consistent 2+-space column gaps.
  Pipe- and tab-delimited blocks are more robust and are recommended for
  downstream ingestion pipelines.
- Does not yet normalize multi-line cells or merged cells.

## Resume Condition
- N/A — stage complete.

## Blocked By
- None.

## Next
- 08-IMG.2 — OCR Acquisition Adapter (try `tesseract.js`).