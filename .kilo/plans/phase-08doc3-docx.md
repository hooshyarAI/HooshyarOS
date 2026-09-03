# Phase 08-DOC.3 — DOCX + DOC Acquisition — Checkpoint

## Stage
- **Stage ID:** 08-DOC.3
- **Title:** DOCX + DOC Acquisition
- **Phase:** 08 — Universal Data Acquisition
- **Parent Stage:** 08
- **Owner:** Backend/HBOS/Product/FinancialDataIngestionAdapter.ts
- **Status:** COMPLETE
- **Timestamp:** 2026-09-03T19:00:00Z
- **Commit SHA:** f591439c5ea87e808b2642e519b2c307896ff5d7

## Implementation
- New module: `Backend/HBOS/Product/DocxAcquisition.ts`
  - `DOCX_ERROR_CODES = { EMPTY, UNSUPPORTED, MISMATCH, PARSE, DOC_NOT_SUPPORTED }`
  - `acquireDocx(params)` -> `DocxExtraction` via `mammoth.extractRawText`
  - `detectDocxMagic(buffer)` / `detectDocFormatByExtension(name)` helpers
  - `.doc` (legacy binary) -> `ingestion-doc-not-supported` (NOT silently extracted)
- Dependency added: `mammoth@1.12.2` (BSD-3-Clause)
- Canonical owner NOT modified.

## Inputs
- raw docx bytes + sourceName (must end in .docx)

## Outputs
- DocxExtraction { sourceName, sha256, byteLength, receivedAt, text, messages }

## Verification Metric
- `npm test -- --testPathPattern="DocxAcquisition"` — 9/9 PASS
- baseline 61 preserved

## Resource Policy
- None (size policy delegated to adapter)

## Security Controls
- Magic-byte validation (ZIP signature) before invoking mammoth
- Mammoth treats the .docx as untrusted; no macro execution, no remote loads
- Mismatched extension -> `ingestion-format-mismatch`
- Corrupt docx -> `ingestion-docx-parse-error:<message>`

## Known Limitations
- .doc legacy binary is NOT supported (requires native `antiword` or
  similar; not in scope for this stage)
- No image extraction; only `extractRawText`

## Resume Condition
- N/A — stage complete.

## Blocked By
- None.

## Next
- 08-DOC.4 — Document table extraction / normalization.