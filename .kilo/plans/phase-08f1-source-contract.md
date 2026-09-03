# Phase 08-F.1 — Universal File Source Contract

## Metadata

| Field | Value |
|-------|-------|
| stageId | 08-F.1 |
| parentStage | 08 |
| status | COMPLETE |
| timestamp | 2026-09-03T16:45:00Z |
| commitSha | 2805bd79c754e1b1b06c85ffc55e747c58d798b7 |
| owner | FinancialDataIngestionAdapter |
| capabilityId | product.financial-data-ingestion |

## Inputs

* Existing CSV/JSON contracts (Phase 08-A)
* XLSX acquisition (Stage 08-D.1, checkpointed)
* SpreadsheetIngestionConfig and DEFAULT_SPREADSHEET_CONFIG (existing)

## Outputs

### Changed files

| File | Change |
|------|--------|
| Backend/HBOS/Product/FinancialDataIngestionAdapter.ts | Added FileSource, RawSourceRef, FileSourceType, FileSourceMediaType interfaces; added createFileSource, createRawSourceRef, computeSourceSha256 exports |
| Backend/HBOS/test/FileSourceContract.test.ts | New focused test file (24 tests) |

### Test counts

| Suite | Count | Result |
|-------|-------|--------|
| Focused 08-F.1 (FileSourceContract.test.ts) | 24 | 24 passed / 0 failed |
| Regression (FinancialDataIngestionAdapter.test.ts) | 37 | 37 passed / 0 failed |
| **Total** | **61** | **61 passed / 0 failed** |

## VerificationMetric

* TypeScript typecheck on FinancialDataIngestionAdapter.ts: 0 errors
* 24 new focused tests pass
* 37 existing regression tests pass (no tenant, provenance, or canonical-model drift)
* No new Engine created; no duplicate ingestion ownership

## ResourcePolicy

No new resource policy added in this stage. Existing `SpreadsheetIngestionConfig` and `DEFAULT_SPREADSHEET_CONFIG` remain the single source of truth for size/time limits.

## SecurityControls

* No new security controls added in this stage (contract only)
* Existing controls preserved:
  * SHA-256 computed via `createHash("sha256")` (same primitive used by existing CSV/JSON/XLSX paths)
  * `rawSourceRef.persisted = false` is truthful — no fake storage claim
  * `persistenceKey` is namespaced (`raw-source:<sha256>`) and tenant-scoping remains the caller's responsibility via the existing `SQLitePersistenceStore` boundary

## KnownLimitations

* XLS remains BLOCKED_DEPENDENCY (xlsx@0.20.3 unobtainable) — not addressed in this stage
* Raw bytes are NOT auto-persisted by `createFileSource`; the adapter still owns persistence at its canonical boundary
* No media-type for TXT, PDF, DOC/DOCX, images, or enterprise sources yet — these are future producers of this contract

## ResumeCondition

**Next stage:** 08-F.2 — Format & Source Detection Module

**Exact action:** Extract the magic-byte format detection from `FinancialDataIngestionAdapter.ts` into a standalone module-level function set (or co-located helper) that:
1. Returns a discriminated union including the current (CSV, JSON, XLS, XLSX) and a stable extension hook for future media types
2. Is the single source of truth for both extension-based and magic-byte-based detection
3. Throws `ingestion-format-unsupported` and `ingestion-format-mismatch` (existing stable error codes)
4. Is covered by its own focused unit tests for every supported magic and every extension/magic mismatch
5. Does not alter any existing public API

**Unblocked work in parallel after 08-F.1:**
* 08-F.2 (Format & Source Detection Module)
* 08-F.3 (Configurable Resource Policy)
* 08-DOC.1 (TXT acquisition)
* 08-IMG.1 (Image acquisition, raw)
* 08-ENT.1 (Generic API connector contract)
* 08-ENT.2 (Generic DB connector contract)

## BlockedBy

None. This stage has zero external dependencies.

---

**STAGE_08_F1_COMPLETE**
