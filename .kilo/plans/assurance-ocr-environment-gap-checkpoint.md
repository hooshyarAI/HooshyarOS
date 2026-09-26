# Stage 8 Checkpoint — `assurance.ocr-environment-gap`

**Branch:** `fix/autonomous-product-factory`
**Baseline SHA:** `dd4e94826a6c397df834b4e2dc3474f8d383492c`
**Status:** COMPLETE / VERIFIED (truthful boundary recorded; fail-closed adapter)
**Architecture:** Architecture Freeze V4.1 — no Engine created, no frozen contract changed, no dependency installed.

---

## 1. Decision

Per the OCR rule, the supported runtime/product contract was inspected **first**:

- `Docs/Product/FinancialIngestionService.md` (governed runtime surface) explicitly declares
  PDF / DOCX / XLS / Images **Deliberately NOT supported**; images require OCR.
- `SUPPORTED_INGESTION_FORMATS` = `CSV | STRUCTURED | XLSX | TXT`; `/api/ready` advertises
  no OCR capability; the runtime never imports `OcrAdapter`.
- `tesseract.js` is **absent** from `node_modules` and is **not** a declared dependency in
  `package.json`.

**Conclusion: OCR is not supported and must not be made to appear supported.** No OCR
dependency was installed. The gap is recorded truthfully, and the dormant reference adapter
was made to fail closed instead of breaking module loading.

---

## 2. Bounded scope

The only defect was that `OcrAdapter.ts` statically imported an absent, undeclared module,
so its suite failed to compile (`TS2307`) and reported a false product signal.

**Modified**
- `Backend/HBOS/Product/OcrAdapter.ts`
- `Backend/HBOS/test/OcrAdapter.test.ts`
- `Docs/Product/FinancialIngestionService.md`

**Added**
- `.kilo/evidence/jest-full-stage8-ocr-boundary.txt`
- `.kilo/plans/assurance-ocr-environment-gap-checkpoint.md`

---

## 3. Implementation

- Removed the static `import Tesseract from "tesseract.js"`.
- Added an explicit, minimal `OcrEngine` contract plus `TesseractOcrAdapterOptions.engine`
  (dependency injection for tests and future wiring).
- Added `loadTesseractEngine(loader?)` — a lazy, injectable resolver that:
  - returns a CommonJS- or ESM-shaped module exposing `recognize`, else
  - throws `ingestion-ocr-unsupported`.
- `recognize()` resolves the engine **before** the recognition `try/catch`, so an absent
  dependency fails closed with `ingestion-ocr-unsupported` (not a misleading
  `recognize-failed`), while genuine engine errors are still wrapped as
  `ingestion-ocr-recognize-failed`.
- Reconciled the test to drive the contract through an injected engine and to verify the
  absent / malformed / present loader paths deterministically — **no assertion weakened,
  coverage extended**.

---

## 4. Verification evidence

| Check | Command | Result |
|---|---|---|
| Focused OCR/acquisition suites | `jest OcrAdapter OcrProvenance ScannedPdfRouter ImageAcquisition PdfAcquisition DocxAcquisition ConnectorRegistry AcquisitionResourcePolicy --runInBand` | **8/8 suites, 76/76 tests passed** |
| Changed-file typecheck | `tsc --noEmit` (adapter + test) | **exit 0** |
| Full suite | `jest --silent` → `.kilo/evidence/jest-full-stage8-ocr-boundary.txt` | **261/262 suites, 1998/1999 tests passed**; `OcrAdapter` now **passes** (11 tests) |

The single remaining full-suite failure is `CommercialRuntimePersistenceRecovery.test.ts`
(known **F1** timing/resource flake under parallel load; passes in isolation) — Stage 9 scope,
not caused by this stage.

---

## 5. DO-NOT-REPEAT

- Do not install `tesseract.js` or any OCR dependency merely to make a suite green while OCR
  is not part of the supported runtime contract.
- Do not claim OCR/image ingestion support.
- Do not reintroduce a static `tesseract.js` import; keep the engine lazy and optional.
- Do not collapse `ingestion-ocr-unsupported` into `ingestion-ocr-recognize-failed`.
- Do not weaken the injected-engine tests.

---

## 6. Truth boundary

- `productComplete`, `commercialProductRuntimeComplete`,
  `externalProductionDependenciesComplete` unchanged.
- OCR remains explicitly **unsupported / not claimed**; the boundary is now recorded in the
  governed product document and enforced by fail-closed code.
- Architecture Freeze V4.1 preserved; no Engine added; no frozen interface altered.
