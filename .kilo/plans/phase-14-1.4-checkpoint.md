# Phase 14 — Micro-Stage 4 Checkpoint (14-1.4)

**Phase:** 14
**Stage ID:** 14-1.4
**Title:** Browser multi-format upload + application acceptance
**Owner:** `web/` product surface + `CommercialRuntimeServer`; acceptance harness `scripts/web-product-acceptance.cjs`
**Status:** VERIFIED
**Architecture Baseline:** Architecture Freeze V4.1
**Base Commit:** `f7f3dc86`

## Capability

Make the commercial product flow usable with more than CSV-only input, and prove
the representative multi-format dataset path end-to-end through the real runtime.

## Changes

- `web/index.html` — financial-data file input now accepts `.csv`, `.json`,
  `.xlsx`, `.txt` with matching MIME types; guidance updated.
- `web/app.js` — the analysis form now detects the file format and drives the real
  two-step product path: `POST /api/ingest` (text or base64 for XLSX) →
  `POST /api/financial/analyze` with the returned `evidence.sha256`. CSV behaviour
  is preserved; XLSX/JSON/TXT are new.
- `scripts/web-product-acceptance.cjs` — real runtime acceptance extended with:
  STRUCTURED ingestion + analysis, XLSX ingestion (generated via
  `exceljs-hardened`) + analysis, and raw-source evidence listing. Bumped evidence
  version to 3 and acceptance list.

## Application acceptance (real runtime, real HTTP)

`node scripts/web-product-acceptance.cjs` → **PASS**:

```
root, health, session, tenant, ingestion, analysis, executive-workbench,
report, assistant, dashboard, multi-format-ingestion, structured-analysis,
xlsx-analysis, raw-source-evidence
```

- Real input: generated CSV, STRUCTURED JSON and XLSX bytes.
- Real API/runtime: `CommercialRuntimeServer` over HTTP with cookie session.
- Real canonical processing: `FinancialDataIngestionAdapter` → canonical model.
- Persistence: `financial-ingestion:<sha256>` + `raw-source:<sha256>` (tenant-scoped).
- Downstream intelligence: `FinancialIntelligenceEngine` via
  `FinancialStatementAnalysisService`; result persisted and observed through
  `/api/dashboard`.

## Verification

- Application acceptance: PASS (above).
- Focused regression: `Phase14-IngestionRuntime.test.ts` 9/9 PASS.

## Scope note

The repository has no headless-browser automation dependency; browser UI
interaction is not fabricated as tested. The capability's commercial evidence is
the real runtime HTTP path plus the updated product surface.

## Final State

VERIFIED → advance to 14-1.5 (final E2E/regression/checkpoint).
