# Phase 08-DOC.2 — PDF Text-Native Acquisition — Checkpoint

## Stage
- **Stage ID:** 08-DOC.2
- **Title:** PDF Text-Native Acquisition
- **Phase:** 08 — Universal Data Acquisition
- **Parent Stage:** 08
- **Owner:** Backend/HBOS/Product/FinancialDataIngestionAdapter.ts
- **Status:** COMPLETE
- **Timestamp:** 2026-09-03T18:55:00Z
- **Commit SHA:** 8e9d50942ddba8368687d7cfd2e94057497b5207

## Implementation
- New module: `Backend/HBOS/Product/PdfAcquisition.ts`
  - `PDF_ERROR_CODES = { EMPTY, UNSUPPORTED, MISMATCH, PASSWORD, CORRUPT, SCANNED }`
  - `PdfMetadata`, `PdfTextPage`, `PdfTextDocument` contracts
  - `acquirePdf(params)` extracts native text + metadata via `pdf-parse`
  - `detectPdfMagic(buffer)` helper
  - Scanned-only detection: averageCharsPerPage < 50 (configurable) -> `ingestion-pdf-scanned-no-ocr-yet`
- Dependency added: `pdf-parse@2.4.5` (Apache-2.0, pdfjs-dist-based)
- Canonical owner NOT modified (this stage is a pure supporting service).

## Inputs
- raw PDF bytes + sourceName
- optional threshold (default 50 chars/page)

## Outputs
- PdfTextDocument with text, pages, metadata, sha256, byteLength
- deterministic SHA-256 of raw bytes

## Verification Metric
- `npm test -- --testPathPattern="PdfAcquisition"` — 10/10 PASS
- baseline 61 tests preserved (73/73 including worktree duplicates)

## Resource Policy
- 10 MB max size for the test fixture; document-level size policy delegated to adapter layer (not added here)

## Security Controls
- Password-protected PDFs -> `ingestion-pdf-password-protected` (no brute force)
- Corrupt/unsupported PDFs -> `ingestion-pdf-corrupt` / `ingestion-pdf-unsupported`
- Mismatched extension -> `ingestion-format-mismatch`
- No formula evaluation; pdf-parse treats PDF as untrusted document

## Known Limitations
- Threshold 50 chars/page is conservative and may misclassify some
  form-heavy native PDFs as scanned; stage 08-IMG.4 will route scanned
  PDFs to OCR explicitly.
- No streaming; entire PDF is buffered.

## Resume Condition
- N/A — stage complete.

## Blocked By
- None.

## Next
- 08-DOC.3 — DOCX + DOC Acquisition (try `mammoth`).