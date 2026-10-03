# Phase 08-F.3 — Configurable Resource Policy — Checkpoint

## Stage
- **Stage ID:** 08-F.3
- **Title:** Configurable Resource Policy (annotations)
- **Phase:** 08 — Universal Data Acquisition / Zero Manual Data Entry
- **Owner:** Backend/HBOS/Product/FinancialDataIngestionAdapter.ts
- **Status:** COMPLETE

## Implementation
- New module: `Backend/HBOS/Product/AcquisitionResourcePolicy.ts`
  - Exports `PolicyClassification = "PROPOSED_POLICY" | "VERIFIED_CONTROL"`
  - Exports `AnnotatedLimit = { value, classification, rationale }`
  - Exports `AnnotatedSpreadsheetPolicy` (5 annotated fields)
  - Re-exports `DEFAULT_SPREADSHEET_CONFIG` + `SpreadsheetIngestionConfig` from canonical adapter
  - Adds `createAnnotatedPolicy(config)` helper
- Did NOT change existing XLSX security controls. Values unchanged.

## Tests
- New file: `Backend/HBOS/test/AcquisitionResourcePolicy.test.ts`
  - Verifies shape, classifications, rationales and override support.

## Verification
- Command: `npm test -- --testPathPattern="AcquisitionResourcePolicy|FinancialDataIngestionAdapter|FileSourceContract"`
- Result: **PASS** — 10 suites, 79 tests passed.

## Git
- Implementation commit SHA: `7dfd6ea76d699a64d71a8ad248a7b0cfb57ff277`
- Commit message: `feat(ingestion): 08-f.3 configurable resource policy annotations`
- Pushed: YES
- HEAD == origin/fix/autonomous-product-factory

## Next
- 08-DOC.1 — TXT Acquisition.
