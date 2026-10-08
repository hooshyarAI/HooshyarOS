# Stage 7 Checkpoint — `standardization.pagination-and-idempotency`

**Branch:** `fix/autonomous-product-factory`
**Baseline SHA:** `235efe45a333185d630d8745e14c97c541ef0828`
**Status:** COMPLETE / VERIFIED
**Architecture:** Architecture Freeze V4.1 — no Engine created, no frozen contract changed, no architecture change.

---

## 1. Bounded scope

Exactly two standardization gaps from the master ledger, both runtime-local:

- **S3 — pagination:** no bounded `limit/offset` on real list routes.
- **S4 — idempotency:** no replay protection on mutating POSTs that create duplicate side effects.

Re-audit of the *actual runtime routes* (`CommercialRuntimeServer`) identified the real targets;
nothing was paginated/idempotized that did not materially need it.

### Real list endpoints (pagination)
| Route | Canonical owner | Ordering |
|---|---|---|
| `GET /api/sources` | `FinancialIngestionService.listSourcesPage` | SQL `updated_at DESC, key ASC` (total order per tenant) |
| `GET /api/execution/work-items` | `OrganizationalExecutionCoordinator.listWorkItemsPage` | `createdAt DESC, workItemId ASC` |
| `GET /api/report/artifacts` | `ReportExportService.listPage` | artifact index order (newest first) |

Non-list routes (`/api/dashboard`, `/api/report`, `/api/decision/latest`,
`/api/financial/insights/latest`, `/api/diagnostics/metrics`) were deliberately **not** paginated.

### Real duplicate-prone mutating POSTs (idempotency)
| Route | Side effect | Why not other POSTs |
|---|---|---|
| `POST /api/execution/work-items` | creates a new work item | work-item action POSTs are state-guarded (`INVALID_TRANSITION`), no duplicate creation |
| `POST /api/report/export` | creates a new artifact | — |
| `POST /api/ingest` | persists raw source evidence | — |

`/api/analyze`, `/api/financial/analyze`, `/api/executive/workbench`,
`/api/decision/workbench`, `/api/financial/insights` only overwrite a per-tenant
`:latest` key (naturally idempotent); `/api/assistant`, `/api/resilience/*`,
`/api/impact/measure`, `/api/improvement/improve` are pure computation. No
meaningless idempotency header was added to them.

---

## 2. Implementation

### Canonical persistence reuse (no new database / subsystem)
`Backend/HBOS/Product/SQLitePersistenceStore.ts` gained two primitives on the
existing `persistence_records` table:
- `writeIfAbsent(scope, key, value)` — atomic single-writer claim via
  `INSERT … ON CONFLICT DO NOTHING`; returns `{ created, record }`.
- `delete(scope, key)` — releases a claim for retry/recovery.

Idempotency evidence is stored through this store under the tenant scope, so it
is durable, tenant-isolated and survives restarts. No parallel idempotency store.

### Pagination contract
New supporting (non-Engine) `Backend/HBOS/Autonomous/Runtime/QueryPagination.ts`:
- default `limit = 50`, max `limit = 200`;
- strict validation — non-integer/`0`/negative → `PAGINATION_LIMIT_INVALID`,
  `limit > 200` → `PAGINATION_LIMIT_EXCEEDED`, invalid/negative offset →
  `PAGINATION_OFFSET_INVALID` (fails closed, never silently clamps);
- `toPageMeta` emits `{ limit, offset, total, returned, hasMore, nextOffset }`.

List responses are additive: `{ status, tenantId, <items>, pagination }` — the
existing `<items>` array is unchanged for backward compatibility.

### Idempotency contract
`runIdempotent(scope, body, execute)` in the runtime, only on the three routes above:
- validates `Idempotency-Key` (`^[A-Za-z0-9._:-]{1,255}$`) → else `400 IDEMPOTENCY_KEY_INVALID`;
- canonical key scope = tenant + actor + route (`idempotency:<scope>:<userId>:<key>`), persisted under `{ tenantId }`;
- request hash = SHA-256 of the normalized JSON body;
- atomic claim → concurrent duplicates cannot both execute;
- completed key → replay stored status/body with `Idempotency-Replayed: true`;
- same key + different body → `409 IDEMPOTENCY_KEY_CONFLICT`;
- in-progress key → `409 IDEMPOTENCY_IN_PROGRESS` (no second side effect);
- non-2xx / thrown outcomes release the claim so a real retry can proceed;
- absent header → original endpoint contract preserved (backward compatible).

`GET /api/ready` advertises `bounded-pagination` and `idempotency-keys`.

### Real product entrypoint
`web/app.js` now sends a per-scope `Idempotency-Key` (`crypto.randomUUID()` with
fallback) on the three duplicate-prone mutations and rotates it only after
success, so UI double-submission is replayed/blocked and a failed submission can
be safely retried.

---

## 3. Verification evidence

| Check | Command | Result |
|---|---|---|
| Focused — pagination | `jest RuntimePagination.test.ts --runInBand` | **8/8 passed** |
| Focused — idempotency | `jest RuntimeIdempotency.test.ts --runInBand` | **12/12 passed** |
| Integration regression | 16 runtime/auth/ingestion/execution/report/observability suites | **16/16 suites, 103/103 passed** |
| Persistence/recovery regression | 7 store/recovery/rbac suites | **7/7 suites, 67/67 passed** |
| Changed-file typecheck | `tsc --noEmit` (module + 4 owners + server + 2 test files) | **exit 0** |
| Full suite | `jest --silent` → `.kilo/evidence/jest-full-stage7-pagination-idempotency.txt` | **261/262 suites, 1988/1988 tests passed** (only `OcrAdapter` env gap E2) |
| Real HTTP/runtime | in-process server + `fetch` cookies in both new suites | register/login, sessions, rate limits, list/replay headers all exercised |
| Negative/failure paths | invalid key, key conflict, in-progress 409, failed-claim retry, invalid pagination, anonymous 401 | asserted |
| Tenant isolation | same idempotency key across tenants; list total 0 for other tenant | asserted |
| Race safety | two concurrent identical submissions with one key | exactly one side effect |
| Persistence of evidence | replay after real server restart on same DB file | replayed, single artifact |

`CommercialRuntimePersistenceRecovery.test.ts` timed out only inside a multi-suite
in-band batch (known **F1** timing/resource flake) and **passes in isolation**; it
also passed in the full parallel run. It is not caused by this stage and remains
Stage 9 scope.

---

## 4. Files

**Modified**
- `Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts`
- `Backend/HBOS/Product/SQLitePersistenceStore.ts`
- `Backend/HBOS/Product/FinancialIngestionService.ts`
- `Backend/HBOS/Product/OrganizationalExecutionCoordinator.ts`
- `Backend/HBOS/Product/ReportExportService.ts`
- `web/app.js`

**Added**
- `Backend/HBOS/Autonomous/Runtime/QueryPagination.ts`
- `Backend/HBOS/test/RuntimePagination.test.ts`
- `Backend/HBOS/test/RuntimeIdempotency.test.ts`
- `.kilo/evidence/jest-full-stage7-pagination-idempotency.txt`

---

## 5. DO-NOT-REPEAT

- Do not create a new idempotency store/database or a new pagination engine; reuse
  `SQLitePersistenceStore` and `QueryPagination`.
- Do not paginate single-object routes or add idempotency headers to
  overwrite-only/pure-compute POSTs.
- Do not silently clamp out-of-range limits; keep failing closed.
- Do not change the ordering key without re-validating the no-duplicate/no-gap walk.
- Do not weaken the tenant/actor scope of the idempotency key.
- Do not touch `FinancialDataIngestionAdapter.ts` or modify `Engine.initialize()`.

---

## 6. Truth boundary

- `productComplete`, `commercialProductRuntimeComplete`,
  `externalProductionDependenciesComplete` unchanged — this stage adds
  runtime standardization only.
- External dependencies and the OCR environment gap (E2) remain honestly classified.
- Architecture Freeze V4.1 preserved; no Engine added; no frozen interface altered.
