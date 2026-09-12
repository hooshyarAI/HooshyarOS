# Phase 14 — Governed Multi-Format Financial Ingestion (Product/Runtime Flow)

**Status:** READY (authorized)
**Branch:** `fix/autonomous-product-factory`
**Architecture Baseline:** Architecture Freeze V4.1
**Base Commit:** `e0cc6ce0` (Phase 13 final verification)
**Prior Gate:** Phase 13 = VERIFIED / COMPLETE (`.kilo/plans/phase-13-final-checkpoint.md`)

## Owner Authorization

This master plan is **explicitly owner-authorized** by the post-Phase-13 commercial
continuation mission. The human product owner authorized creation of the next
repository-native master plan and its governed execution beyond Phase 13, on the
branch `fix/autonomous-product-factory`, preserving Architecture Freeze V4.1.

## Audit Summary (repository evidence)

Phase 13 completed identity/authentication/RBAC/tenant context. The full Jest run
passed `1835/1835` executable tests with 12 pre-existing environmental/unrelated
suites failing to load. No Phase 13 module is implicated.

Auditing the Commercial Product Completion Contract layer `4. Data ingestion and
canonical data` and the canonical commercial roadmap
(`Docs/Product/PRODUCT_CONSTRUCTION_ROADMAP.json`) shows the first genuinely
missing commercial capability:

> `product.financial-data-ingestion` — *"implement governed multi-format financial
> ingestion beyond the current CSV-only browser flow (Excel/PDF/structured evidence
> where supported by existing architecture)"*

Repository facts:

- The canonical ingestion owner is `Backend/HBOS/Product/FinancialDataIngestionAdapter.ts`.
  It already supports **CSV**, **STRUCTURED (JSON)** and **XLSX** (via
  `exceljs-hardened`) and **TXT** (via `TextFileDecoder`), with validation,
  normalization, SHA-256 provenance and tenant-scoped persistence of the canonical
  model.
- The commercial runtime (`Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts`)
  advertises `financial-ingestion` in `/api/ready`, but the only ingestion path is
  `POST /api/analyze`, which accepts **CSV text only** and conflates ingestion with
  analysis. `web/index.html` accepts only `.csv`.
- The runtime never persists the **raw source evidence** bytes; only the post-ingest
  canonical model is stored. `RawSourceRef`/`FileSource` exist in the adapter but
  are never persisted (`persisted: false`).
- PDF (`PdfAcquisition` + `pdf-parse`) and DOCX (`DocxAcquisition` + `mammoth`)
  helpers exist, but they are **not** declared dependencies of the adapter and are
  not routed by `ingestFile`. OCR (`tesseract.js`) is absent, so scanned-only PDF
  cannot be truthfully supported. The adapter's own documentation still declares
  PDF as **BLOCKED**, and `Phase08-09.OperationalClosure.test.ts` asserts that a
  `.pdf` input yields the CSV fallback error.

## Capability Decision

**Selected capability:** `product.financial-data-ingestion` — expose the canonical
already-supported multi-format ingestion (CSV, STRUCTURED/JSON, XLSX, TXT) through
the commercial runtime and browser product flow, persist tenant-scoped raw-source
evidence with provenance, and connect ingestion results to the canonical financial
intelligence.

**Canonical owner:** `FinancialDataIngestionAdapter` (parsing, validation,
normalization, model persistence). The runtime additions are a **supporting
composition service** and HTTP surface only. **No second ingestion engine or
alternate adapter is created.**

**PDF/DOCX decision (evidence-based, per mission A5):** not implemented in this
phase. The existing architecture provides parsers but they are not direct
dependencies of the canonical owner, OCR is unavailable, and wiring them would
require modifying the protected adapter/test contract and would contradict the
adapter's own BLOCKED declaration. This is recorded truthfully rather than
inventing parser infrastructure or fake support.

**Why this capability is next:** it is the lowest-numbered incomplete capability in
the contract's commercial MVP priority order after the completed runtime shell,
persistence/tenant scope, and authentication/RBAC (Phase 12/13), and the roadmap's
own acceptance criteria state that CSV-only behaviour does not satisfy it.

## Micro-Stage Queue (stage boundaries)

| ID | Title | Canonical Owner | Objective |
|----|-------|-----------------|-----------|
| 14-1.1 | Canonical multi-format ingestion runtime | FinancialDataIngestionAdapter (via supporting service) + CommercialRuntimeServer | Add supporting `FinancialIngestionService` dispatching CSV/STRUCTURED/XLSX/TXT to the canonical adapter; expose `POST /api/ingest` with RBAC `INGEST_DATA`, fail-closed validation, provenance |
| 14-1.2 | Tenant-scoped raw-source evidence | FinancialIngestionService + SQLitePersistenceStore | Persist raw source bytes under `raw-source:<sha256>` per tenant; expose `GET /api/sources` and `GET /api/sources/:sha256` with cross-tenant rejection |
| 14-1.3 | Ingestion → canonical financial intelligence | FinancialStatementAnalysisService / FinancialIntelligenceEngine | Route runtime ingestion through the shared service so `/api/analyze` keeps working, and add analysis over the last ingested canonical model so multi-format data reaches canonical intelligence |
| 14-1.4 | Browser multi-format upload + application acceptance | web surface + CommercialRuntimeServer | Accept CSV/JSON/XLSX in `web/index.html`+`app.js`; extend the real runtime acceptance harness with a representative multi-format dataset (XLSX + CSV) |
| 14-1.5 | E2E, regression, checkpoint | All | Full E2E, focused regression, durable checkpoint, commit, push, remote verify |

## Dependencies (all satisfied)

- `FinancialDataIngestionAdapter` (CSV/STRUCTURED/XLSX/TXT) — exists, verified.
- `SQLitePersistenceStore` tenant-scoped boundary — exists, verified.
- `CommercialIdentityService` RBAC (`INGEST_DATA`, `READ_DASHBOARD`) — exists, Phase 13.
- `FinancialStatementAnalysisService` + `FinancialIntelligenceEngine` — exists.
- `exceljs-hardened`, `mammoth`, `pdf-parse` — installed (PDF deliberately unused).

## Acceptance Criteria

- `POST /api/ingest` accepts CSV, STRUCTURED/JSON, XLSX (base64) and TXT through the
  canonical adapter; unsupported/malformed input fails closed with an explicit code.
- Every successful ingest returns truthful provenance (sourceName, sourceType,
  sha256 of original bytes, receivedAt, byteLength) and is tenant-scoped.
- Raw source evidence is persisted durably and is retrievable only by its tenant.
- `GET /api/sources` lists only the caller's sources; cross-tenant access is rejected.
- Existing `/api/analyze` CSV behaviour, `/api/dashboard`, `/api/report`,
  `/api/executive/workbench` continue to pass (no regression).
- Ingested multi-format data reaches the canonical financial intelligence and is
  observable through the runtime (application acceptance).
- The browser product flow accepts more than CSV-only input.
- No PDF/DOCX support is falsely claimed.

## Evidence required per stage

- Focused unit/integration test for the changed contract.
- Runtime E2E test exercising the real HTTP path with a real tenant session.
- Application acceptance via `scripts/web-product-acceptance.cjs` (and/or a new
  representative multi-format harness) proving input → API → canonical processing →
  persistence → intelligence → observable result.
- Architecture compliance check: single owner, no duplicate engine, no weakened test.
- Durable checkpoint under `.kilo/plans/`, committed and pushed.

## Risk, stop conditions, repair budget

- **Risk:** changing the protected `FinancialDataIngestionAdapter` semantics.
  Mitigation: only additive/visibility changes (`ingestXlsx` exposes the existing
  private parser; no behaviour change). No adapter test is modified.
- **Risk:** breaking the heavily-used `/api/analyze` contract. Mitigation: preserve
  its request/response shape; route its CSV through the shared service.
- **Stop conditions:** architecture contradiction, protected-capability conflict,
  a regression that cannot be repaired within budget, or any attempt to fabricate
  PDF support.
- **Bounded repair budget:** 3 focused repair attempts per stage; then BLOCKED with
  preserved evidence and return to the last trusted checkpoint.

## Completion States

This phase advances `canonicalPlatformConstructionComplete` and
`commercialProductRuntimeComplete` for the ingestion layer only. It does **not**
make `productComplete=true`; external production dependencies and later layers
(dashboards/reports/decision/execution/deployment) remain outstanding.

## Final State

PLANNED → executing from 14-1.1.

## Execution Log

| Stage | Status | Evidence | Commit |
|-------|--------|----------|--------|
| 14-1.1 + 14-1.2 | VERIFIED (delivered as one coherent ingestion transaction) | `Phase14-IngestionRuntime.test.ts` 6/6; regression 70/70 | `4ecdd61f` |
| 14-1.3 | VERIFIED | `Phase14-IngestionRuntime.test.ts` 9/9; analysis/runtime regression 35/35 | see `phase-14-1.3-checkpoint.md` |
| 14-1.3 | PENDING | — | — |
| 14-1.4 | PENDING | — | — |
| 14-1.5 | PENDING | — | — |

Note: planned stages 14-1.1 (runtime multi-format ingestion) and 14-1.2
(tenant-scoped raw-source evidence) were delivered as a single architectural
transaction because they share the same owner and contract; per the Final
Decisions Register, capability discipline does not justify artificial
fragmentation.

