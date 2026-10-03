# Phase 14 — Micro-Stage 1 Checkpoint (14-1.1 + 14-1.2)

**Phase:** 14
**Stage ID:** 14-1.1 + 14-1.2 (delivered as one coherent ingestion transaction)
**Title:** Canonical multi-format ingestion runtime + tenant-scoped raw-source evidence
**Owner:** `FinancialDataIngestionAdapter` (canonical); `FinancialIngestionService` (supporting); `CommercialRuntimeServer` (surface)
**Status:** VERIFIED
**Architecture Baseline:** Architecture Freeze V4.1
**Base Commit:** `e0cc6ce0` (Phase 13 final)

## Capability

`product.financial-data-ingestion` — expose already-supported canonical formats
(CSV, STRUCTURED/JSON, XLSX, TXT) through the commercial runtime with truthful
provenance and tenant-scoped raw-source evidence.

## Why this capability is next

Derived from `Docs/Product/PRODUCT_CONSTRUCTION_ROADMAP.json`
(`product.financial-data-ingestion`, acceptance explicitly rejects CSV-only),
the Commercial Product Completion Contract layer 4, and the Phase 13 trusted
state. Not selected from conversational memory or a guessed phase name.

## Changes

- `Backend/HBOS/Product/FinancialIngestionService.ts` (NEW) — supporting
  composition service: format dispatch to canonical adapter, raw-source
  persistence, tenant-scoped list/read.
- `Backend/HBOS/Product/FinancialDataIngestionAdapter.ts` — additive/visibility
  only: `ingestXlsx` made public (existing parser), new `ingestTxtBytes`
  (`ingestTxt` refactored to delegate). No behaviour change.
- `Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts` — `POST /api/ingest`,
  `GET /api/sources`, `GET /api/sources/:sha256`; 8 MB ingest body limit;
  `/api/ready` capability list updated.
- `Backend/HBOS/test/Phase14-IngestionRuntime.test.ts` (NEW) — 6 focused tests.
- `Docs/Product/FinancialIngestionService.md` (NEW) — capability contract.

## Non-goals (truthfully recorded)

PDF and DOCX are **not** implemented: parsers exist but are not direct
dependencies of the canonical owner, OCR is absent, and the adapter contract
declares PDF BLOCKED. No fake support was created.

## Verification

- Focused: `Phase14-IngestionRuntime.test.ts` — 6/6 PASS (service multi-format,
  raw-evidence tenancy, fail-closed malformed input, HTTP endpoints, RBAC,
  cross-tenant 404, unauthenticated 401).
- Regression: `FinancialDataIngestionAdapter.test.ts` (x2),
  `Phase08-09.OperationalClosure.test.ts`, `TextFileAcquisition.test.ts`,
  `CommercialRuntimeServer.e2e.test.ts`, `Phase13-E2E.test.ts` — 70/70 PASS.
- Architecture compliance: single canonical owner, no duplicate adapter,
  no test weakened.

## Acceptance mapping

- Real input (CSV/JSON/XLSX/TXT) → real API (`POST /api/ingest`) → canonical
  processing (adapter) → persistence (raw evidence + canonical model) →
  observable result (provenance + totals). Downstream intelligence wiring is
  stage 14-1.3.

## Final State

VERIFIED → advance to 14-1.3.
