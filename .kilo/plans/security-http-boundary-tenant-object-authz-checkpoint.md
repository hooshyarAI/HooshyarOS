# Checkpoint — `security.http-boundary-tenant-object-authz` (HTTP-boundary tenant + object authorization)

**Status:** VERIFIED — ready to commit
**Branch:** `fix/autonomous-product-factory`
**Trusted baseline:** `1f01178dd3cadf54ec140d593aa76f8cfa1c00a1`
**Architecture:** Architecture Freeze V4.1 (unchanged)
**Classification:** DEFENSE-IN-DEPTH SECURITY GAP (object routes relied on service-level tenant scoping only; no explicit HTTP-boundary tenant/object check) — integrated the canonical `TenantIsolation` guard
**Authority:** `.kilo/plans/ACTIVE-COMMERCIALIZATION-MASTER-LEDGER.md` §3.4 (S5, S7); audit §36

---

## Knot

One coherent security knot: integrate the canonical `TenantIsolation` guard at the HTTP boundary for object-returning routes and add an explicit object-level owner/admin authorization for work-item reads. No new security engine; the existing canonical guard and identity authorization model are reused.

One capability = one owner = one implementation = one test = one commit.

## Defect (exact)

- **S5:** HTTP object routes relied solely on service-level tenant scoping (`listWorkItems`/`readSource`/`reportExport.read` filter by tenant). Nothing re-verified the returned object's tenant at the boundary, so any future service-scoping regression would leak cross-tenant objects silently. The canonical `Security/TenantIsolation.checkAccess()` existed but was not invoked by the runtime.
- **S7:** `GET /api/execution/work-items/:id` was tenant-scope only — any authenticated member of the same tenant could read any work item regardless of ownership.

## Repair (canonical owner: `CommercialRuntimeServer`)

- Imported the canonical `TenantIsolation` and `Authorization`/`AuthorizationResult`.
- Added `enforceTenantBoundary(resource, action)`: invokes `TenantIsolation.checkAccess(executionContext(session), resource, action)` and, on denial, logs a `TENANT_VIOLATION` security event and fails closed.
- Applied it to object-returning routes:
  - `GET /api/execution/work-items/:id` → denied mismatches return `404 WORK_ITEM_NOT_FOUND` (no existence disclosure);
  - `GET /api/sources/:sha` → denied mismatches return `404 SOURCE_NOT_FOUND`;
  - `GET /api/report/artifacts/:id/download` → denied mismatches return `404 REPORT_ARTIFACT_NOT_FOUND`.
- Added `canAccessWorkItem(item)`: privileged roles (OWNER/ADMIN — holders of `Authorization.ADMINISTER`) may read any item in their tenant; otherwise the actor must be the creator, approver, or assignee. Same-tenant non-owners receive `403 WORK_ITEM_FORBIDDEN` (and an audited `AUTHORIZATION_DENIAL`).

No architecture change; no new engine; the passwordless bootstrap gate and all existing permission gates are untouched.

## Behavioral tests (real HTTP — `OrganizationalExecutionRuntime.test.ts`)

New tests:

1. **Object-level authorization** (`enforces object-level authorization on work-item reads`):
   - valid same-tenant owner/admin read → **200**;
   - same-tenant non-owner VIEWER (not creator/assignee/approver) read → **403 `WORK_ITEM_FORBIDDEN`**;
   - viewer still lists tenant work items → **200**;
   - unauthenticated read → **401**;
   - cross-tenant read → **404 `WORK_ITEM_NOT_FOUND`** (not disclosed).
2. **Audit evidence** (`audits the object-level authorization denial`): with a real `SecurityEventLogger` SQLite store, the viewer denial writes an `audit_events` row whose reason contains `WORK_ITEM_OBJECT_FORBIDDEN`.

Existing `keeps work items tenant-scoped` and `enforces RBAC` tests continue to pass unchanged.

## Verification

| Check | Command / artifact | Result |
|---|---|---|
| Focused | `jest …OrganizationalExecutionRuntime.test.ts --runInBand` | **1 suite, 6/6 tests passed** |
| Integration regression | 18 runtime/auth/tenant/execution/report suites | **18/18 suites, 117/117 tests passed** |
| Changed-file typecheck | `tsc --noEmit` (server + execution test) | **exit 0** |
| Full suite | `jest --silent` → `.kilo/evidence/jest-full-stage5-http-boundary-tenant-object-authz.txt` | **257/259 suites, 1962/1963 tests** |

## Remaining failures (pre-existing, independently classified — not caused by this knot)

| Suite | Class |
|---|---|
| `test/CommercialRuntimePersistenceRecovery.test.ts` | TIMING/RESOURCE FLAKE (5 s budget under load; passes in isolation) |
| `test/OcrAdapter.test.ts` | ENVIRONMENT GAP (`tesseract.js` absent) |

## Changed files

- `Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts`
- `Backend/HBOS/test/OrganizationalExecutionRuntime.test.ts`
- `.kilo/evidence/jest-full-stage5-http-boundary-tenant-object-authz.txt`
- `.kilo/plans/security-http-boundary-tenant-object-authz-checkpoint.md`
- `.kilo/plans/platform-wide-commercialization-conformance-audit.md` (§36)
- `.kilo/plans/ACTIVE-COMMERCIALIZATION-MASTER-LEDGER.md`
- `.kilo/plans/AUTONOMOUS-COMMERCIALIZATION-EXECUTION-QUEUE.md`

## Architecture proof

No engine moved or duplicated; the canonical `Security/TenantIsolation` and identity authorization model are reused; no parallel authorization layer; Architecture Freeze V4.1 preserved.

## Truth boundary

No change to `productComplete`, `commercialProductRuntimeComplete` or `externalProductionDependenciesComplete`. No assertion weakened, no test skipped or deleted. Cross-tenant probes return not-found (no existence disclosure); same-tenant wrong-owner denials are explicit and audited.

## Next candidate knot (not executed)

`observability.metrics-and-request-trace` — additive request correlation/trace + operation metrics on critical runtime paths using canonical infrastructure (no architecture change).
