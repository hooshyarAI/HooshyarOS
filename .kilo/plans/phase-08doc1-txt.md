# Phase 08-DOC.1 — TXT Acquisition — Checkpoint

## Stage
- **Stage ID:** 08-DOC.1
- **Title:** TXT Acquisition
- **Phase:** 08 — Universal Data Acquisition
- **Owner:** Backend/HBOS/Product/FinancialDataIngestionAdapter.ts
- **Status:** COMPLETE

## Implementation
- New module: `Backend/HBOS/Product/TextFileDecoder.ts` (UTF-8, UTF-8 BOM, UTF-16 LE, UTF-16 BE)
- Adapter extended:
  - new `TxtEncoding` type + `TxtIngestionResult` interface
  - new `ingestTxt(tenantId, sourceName, sourcePath)` method
  - `ingestFile` routes `.txt` to `ingestTxt` which decodes then reuses `ingestCsv` (so the 5-column CSV schema rejection rule is inherited)
- No Engines created; supporting service + adapter extension.

## Tests
- New file: `Backend/HBOS/test/TextFileAcquisition.test.ts` (6 focused tests)
- Existing 61 tests untouched.

## Verification
- Command: `npm test -- --testPathPattern="TextFileAcquisition|FinancialDataIngestionAdapter|FileSourceContract"`
- Result: **PASS** — 10 suites, 79 tests passed.

## Git
- Implementation commit SHA: `ea56a953bd5fa1e93b3e644582c7fbaedf4cad2d`
- Commit: `feat(ingestion): 08-doc.1 txt acquisition with encoding detection`
- Pushed: YES
- HEAD == origin/fix/autonomous-product-factory

## Next
- 08-IMG.1 — Raw Image Acquisition.
