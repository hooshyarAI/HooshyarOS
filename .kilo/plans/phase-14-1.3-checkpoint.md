# Phase 14 — Micro-Stage 3 Checkpoint (14-1.3)

**Phase:** 14
**Stage ID:** 14-1.3
**Title:** Ingestion → canonical financial intelligence integration
**Owner:** `FinancialStatementAnalysisService` / `FinancialIntelligenceEngine`; `CommercialRuntimeServer` surface
**Status:** VERIFIED
**Architecture Baseline:** Architecture Freeze V4.1
**Base Commit:** `4ecdd61f`

## Capability

Make ingested multi-format canonical data actually flow into the canonical
financial intelligence and be observable through the runtime — not just parsed
and stored.

## Changes

- `Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts`
  - `POST /api/financial/analyze` — analyzes a tenant's ingested canonical model by
    `sourceSha256`, runs the canonical `FinancialStatementAnalysisService`, persists
    the analysis and returns `ingestedSource` provenance.
  - `POST /api/analyze` refactored to route its CSV through the shared
    `FinancialIngestionService` (response shape unchanged; now also records raw
    source evidence).
  - `/api/ready` advertises `ingested-source-analysis`.
- `Backend/HBOS/Product/FinancialStatementAnalysisService.ts` — the canonical
  analysis boundary now accepts canonical `XLSX` source evidence (previously
  CSV/STRUCTURED only). XLS remains excluded (unsupported). No test weakened.
- `Backend/HBOS/test/Phase14-IngestionRuntime.test.ts` — +3 tests (9 total).
- `Docs/Product/FinancialIngestionService.md` — documents the integration endpoint.

## Verification

- Focused: `Phase14-IngestionRuntime.test.ts` — 9/9 PASS.
- XLSX → `/api/financial/analyze` → `READY`, `targetEngine=Financial Intelligence
  Engine`, `debtRatio=0.25`, persisted and visible via `/api/dashboard`.
- Cross-tenant analysis of another tenant's source → `422 INGESTED_SOURCE_REQUIRED`.
- Regression: `FinancialStatementAnalysisService` (x2), `CommercialRuntimeServer.e2e`,
  `Phase13-E2E`, `CommercialRuntimeServer.resilience` — 35/35 PASS.

## Architecture compliance

- One capability = one owner; the runtime delegates to the canonical analysis
  service; no duplicate engine.
- The analysis boundary was widened to match the canonical source types the owner
  already supports; no new parser or engine invented.

## Final State

VERIFIED → advance to 14-1.4.
