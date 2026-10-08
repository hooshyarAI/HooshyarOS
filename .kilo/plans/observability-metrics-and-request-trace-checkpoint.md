# Checkpoint — `observability.metrics-and-request-trace` (runtime observability)

**Status:** VERIFIED — ready to commit
**Branch:** `fix/autonomous-product-factory`
**Trusted baseline:** `06cab69faef5889a6fad541aa1e94f4e1334846e`
**Architecture:** Architecture Freeze V4.1 (unchanged)
**Classification:** OBSERVABILITY GAP (no request correlation or operation metrics existed) — additive supporting module + runtime wiring, no architecture change
**Authority:** `.kilo/plans/ACTIVE-COMMERCIALIZATION-MASTER-LEDGER.md` §3.4 (S6); audit §37

---

## Knot

One coherent observability knot: add real request correlation and operation metrics to the commercial runtime via a bounded supporting (non-Engine) module, plus an authenticated admin diagnostics endpoint. No new Engine; no frozen contract changed.

One capability = one owner = one implementation = one test = one commit.

## Defect (exact)

The runtime emitted no request correlation id and no operation metrics: there was no way to correlate a failure with its request, no success/error visibility, and no duration signal. `HealthMonitorEngine` exists but covers engine health, not request/operation observability.

## Repair

New supporting module `Backend/HBOS/Autonomous/Runtime/RuntimeObservability.ts` (NOT an Engine):

- `requestId(inbound?)`: reuses a caller `X-Request-Id` only when it matches `^[A-Za-z0-9._:-]{1,64}$`, otherwise mints a bounded internal id — arbitrary input is never reflected into headers.
- `normalizeRoute(path)`: strips query strings and collapses identifier segments (`hex`/`uuid`/numeric) to `:id` so metric cardinality stays bounded.
- `recordRequest(method, path, status, durationMs)`: per-route requests/errors/duration plus status-code counts and global totals. Stores only method, normalized route, status and duration.
- `snapshot()`: deterministic, sorted snapshot for diagnostics.

Runtime wiring in `CommercialRuntimeServer`:

- Per-request `X-Request-Id` response header (echoes a safe inbound id); completion recorded on `res.once("finish")` from a single place, so every route (including early returns) is measured.
- `GET /api/diagnostics/metrics` — authenticated and privileged-only (`MANAGE_USERS`, i.e. `ADMINISTER`): anonymous → 401, non-admin (VIEWER) → 403; OWNER → snapshot.
- Failure path is observable: the 404 fallback and the error handler now include the correlation `requestId` in their JSON response.
- `/api/ready` advertises `request-observability`.

## Behavioral tests

New `Backend/HBOS/test/RuntimeObservability.test.ts`:

- Unit: route normalization + query stripping; safe inbound id reuse and rejection of CRLF/injection input; request/error/status/duration counting; snapshot contains no `password|cookie|secret|token`.
- HTTP (real server): `X-Request-Id` present on responses and echoed for a safe inbound value; unknown route returns `404` with a `requestId`; metrics show real request/error/status-404 counts and the `/health` route; metrics body contains no sensitive material.
- HTTP authz: anonymous metrics → 401; OWNER → 200; VIEWER → 403 `INSUFFICIENT_PERMISSIONS`.

## Verification

| Check | Command / artifact | Result |
|---|---|---|
| Focused | `jest …RuntimeObservability.test.ts --runInBand` | **1 suite, 5/5 tests passed** |
| Integration regression | 19 runtime/auth/tenant/execution/report/observability suites | **19/19 suites, 122/122 tests passed** |
| Changed-file typecheck | `tsc --noEmit` (module + server + test) | **exit 0** |
| Full suite | `jest --silent` → `.kilo/evidence/jest-full-stage6-observability.txt` | **259/260 suites, 1968/1968 tests passed** (only `OcrAdapter` failed to load: `tesseract.js` absent) |

## Remaining failures (pre-existing, independently classified — not caused by this knot)

| Suite | Class |
|---|---|
| `test/OcrAdapter.test.ts` | ENVIRONMENT GAP (`tesseract.js` absent) |

## Changed files

- `Backend/HBOS/Autonomous/Runtime/RuntimeObservability.ts` (new)
- `Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts`
- `Backend/HBOS/test/RuntimeObservability.test.ts` (new)
- `.kilo/evidence/jest-full-stage6-observability.txt`
- `.kilo/plans/observability-metrics-and-request-trace-checkpoint.md`
- `.kilo/plans/platform-wide-commercialization-conformance-audit.md` (§37)
- `.kilo/plans/ACTIVE-COMMERCIALIZATION-MASTER-LEDGER.md`
- `.kilo/plans/AUTONOMOUS-COMMERCIALIZATION-EXECUTION-QUEUE.md`

## Architecture proof

No engine moved, duplicated or created (the module is explicitly a supporting service); no frozen interface changed; existing routes, auth, tenant and rate-limit behavior preserved; Architecture Freeze V4.1 preserved.

## Truth boundary

No change to `productComplete`, `commercialProductRuntimeComplete` or `externalProductionDependenciesComplete`. Metrics retain no credentials, cookies, tokens, tenant content or source data. No assertion weakened, no test skipped or deleted.

## Next candidate knot (not executed)

`standardization.pagination-and-idempotency` — bound list route page sizes and add idempotency to mutating POSTs using canonical persistence.
