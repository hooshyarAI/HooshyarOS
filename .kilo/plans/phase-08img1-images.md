# Phase 08-IMG.1 — Raw Image Acquisition — Checkpoint

## Stage
- **Stage ID:** 08-IMG.1
- **Title:** Raw Image Acquisition (.png, .jpg, .jpeg)
- **Phase:** 08 — Universal Data Acquisition
- **Owner:** Backend/HBOS/Product/FinancialDataIngestionAdapter.ts
- **Status:** COMPLETE

## Implementation
- New module: `Backend/HBOS/Product/ImageAcquisition.ts`
  - `ImageFormat = "PNG" | "JPEG"`
  - `ImageSource` contract (sourceName, format, mediaType, sha256, byteLength, receivedAt)
  - `IMAGE_ERROR_CODES = { EMPTY, TOO_LARGE, UNSUPPORTED, MISMATCH }`
  - `acquireImage` (size policy default 10 MB, magic check, ext-vs-magic mismatch)
- Adapter extended:
  - `FileSourceType` union gains `"IMAGE"`
  - `FileSourceMediaType` union gains `"image/png"` / `"image/jpeg"`
  - new `ingestImage(sourcePath)` method returning `ImageSource`
  - `ingestFile` routes `.png`/`.jpg`/`.jpeg` to validation then throws `ingestion-image-requires-ocr` (OCR pipeline is 08-IMG.2+)
- No OCR performed; size policy 10 MB default per spec.

## Tests
- New file: `Backend/HBOS/test/ImageAcquisition.test.ts` (15 tests).

## Verification
- Command: `npm test -- --testPathPattern="(ImageAcquisition|FormatDetection|TextFileAcquisition|FinancialDataIngestionAdapter|FileSourceContract)"`
- Result: **PASS** — 12 suites, 117 tests.

## Git
- Implementation commit SHA: `e5a6f20c0b0de396487f7df0b4cf9d4333fa5a6d`
- Commit: `feat(ingestion): 08-img.1 raw image acquisition (png/jpeg)`
- Pushed: YES

## Next
- 08-DOC.2 — PDF Text-Native Acquisition (try `pdf-parse`).
