# HooshyarOS — Autonomous Commercialization Execution Queue

**Branch:** `fix/autonomous-product-factory`
**Queue derived from:** `.kilo/plans/ACTIVE-COMMERCIALIZATION-MASTER-LEDGER.md` (fresh audit at `a0f0018c`)
**Status:** ACTIVE — self-replanning after every stage
**Rule:** Derived from the fresh audit; never invented in advance. One coherent root cause = one bounded change set = one test boundary = one commit.

---

## Per-stage mandatory flow

```
DISCOVER → DEFINE bounded scope → INSPECT canonical owner/architecture
→ IMPLEMENT minimal complete repair → ADD/strengthen behavioral tests
→ VERIFY focused → VERIFY relevant regression → VERIFY changed-file static/typechecks
→ VERIFY runtime where applicable → CLASSIFY remaining failures
→ WRITE CHECKPOINT → STAGE ONLY stage files → ONE COMMIT → PUSH
→ VERIFY LOCAL == ORIGIN == LS-REMOTE → RE-AUDIT → SELECT NEXT
```

State progression: `PLANNED → READY → EXECUTING → VERIFYING → CHECKPOINTED → COMPLETE`.

---

## Queue (ranked)

| Order | Stage ID | Source ledger | Scope (bounded) | Canonical owner | Safety | Status |
|---|---|---|---|---|---|---|
| 1 | `assurance.stale-test-reconciliation` | V1–V5 | Reconcile 5 stale suites to current frozen contracts (Governance Engine void-init; Kilo script 1-arg; 3× phase-09 services) | test files only; contracts already frozen | HIGH | **COMPLETE** |
| 2 | `assurance.local-folder-watcher-lifecycle` | E1 | Diagnose + fix Windows libuv native abort (watcher lifecycle vs test teardown) or record explicit reproducible exclusion; **isolated** | LocalFolderWatcher owner + test | MEDIUM | **COMPLETE** |
| 3 | `security.auth-route-rate-limiting` | S2 | Apply existing limiter to `/api/session` + `/api/auth/login`; negative 429 test | `CommercialRuntimeServer` | HIGH | **COMPLETE** |
| 4 | `product.web-password-auth` | S1 | Real register/login in web UI via existing `/api/auth/*` (no new engine) | `web/` + runtime auth | MEDIUM | **COMPLETE** |
| 5 | `security.http-boundary-tenant-object-authz` | S5,S7 | Invoke `TenantIsolation.checkAccess()` + explicit object-owner check at HTTP boundary | `TenantIsolation`, runtime routes | MEDIUM | **COMPLETE** |
| 6 | `observability.metrics-and-request-trace` | S6 | Additive metrics + structured request trace (no architecture change) | runtime diagnostics | MEDIUM | **COMPLETE** |
| 7 | `standardization.pagination-and-idempotency` | S3,S4 | Bounded `limit/offset` on list routes; idempotency keys on mutating POSTs | runtime | MEDIUM | **COMPLETE** |
| 8 | `assurance.ocr-environment-gap` | E2 | Resolve only if runtime contract requires; else record explicit, non-hidden gap | `OcrAdapter` | HIGH | PLANNED |
| 9 | `assurance.flake-containment` | F1,F2 | Analyze + contain parallel-load resource contention (timeouts/serial projects) without hiding real failures | test config + affected tests | HIGH | PLANNED |
| 10 | `standardization.architecture-doc-registry-reconciliation` | C8 | Reconcile LifecycleManager tier drift + stale dormant labels to repository truth | docs/registry | HIGH | PLANNED |
| 11 | `assurance.construction-remote-attestation` | C9 | Independent GitHub-remote verification at phase end | `LocalConstructionToolset` | MEDIUM | PLANNED |
| 12 | `product.offline-sync` | C1 | Wire existing `SyncStateStore` owner (no rebuild) | `Product/SyncStateStore.ts` | MEDIUM | PLANNED |
| — | `security.encryption-at-rest` | C5 | BLOCKED — ARCHITECTURE CHANGE CONTROL / pending human 05C approval | 05C decisions | — | BLOCKED |
| — | `product.billing-entitlements` | C2 | BLOCKED_EXTERNAL_DEPENDENCY (payment provider account/webhook) | — | — | BLOCKED_EXTERNAL |
| — | `deployment.cloud-production` | C4 | BLOCKED_EXTERNAL_DEPENDENCY (cloud/DNS/TLS credentials) | — | — | BLOCKED_EXTERNAL |

---

## Stage 1 — `assurance.stale-test-reconciliation`

**State:** COMPLETE
**Baseline SHA:** `a0f0018c43f910c7dcd5e4c025bd2b2a74ec27a8`
**Result:** 5 reconciled suites green (32/32 focused); 11-suite regression 97/97; changed-file typecheck exit 0; full suite **255/259 suites, 1943/1945 tests**. Remaining failures = E1, E2, F1, and the last Kilo/pid-file adapter (F2). No assertion weakened; no test deleted; no obsolete API restored.
**Bounded scope:** exactly the 5 stale suites. No engine, product capability, runtime, or frozen interface changes.

**DISCOVER / INSPECT (done):**
- `Core/Engine.ts:6` — `initialize(): void` (frozen; do not change).
- `GovernanceEngine.test.ts` asserts `.status` on void → compile fail. Canonical behavior already covered by `GovernanceEngine.06-F.test.ts` and `GovernanceEngine.phase-11-1.6.test.ts`.
- `KiloCodeExecutionAdapter.ts:113` — `buildWindowsKiloScript(payloadPath: string)` (1 arg). Test passes 2 args and asserts removed `$timeoutMs`/`$startTime` text.
- `BreakEvenAnalysisService.ts` — current contract `analyze(BreakEvenAnalysisInput)`, `marginOfSafety(actualUnits, breakEvenUnits)`, `margins(MarginsInput)`. Phase-09 test targets superseded shapes.
- `CashFlowForecastingService.ts` — current contract `naive(history)`, `movingAverage(history, window)`, `linearTrend(history)`; no horizon/`points`.
- `ExponentialSmoothingService.ts` — current contract `ses(history, alpha)` returning `{smoothed,status}`; blocks `alpha<=0`/`>=1`; no `fitted/points/inSampleMae`.
- Roadmap/checkpoint evidence (`phase-09-final-checkpoint.md:74-79`) confirms the current simpler methods are the canonical contract.

**Decision:** Reconcile (rewrite) the 5 suites to test the **current frozen behavior with strengthened assertions**. No obsolete API restored; no test deleted; no assertion weakened.

**Prerequisites:** none.

**Expected evidence after repair:**
- Focused: 5 suites green with real assertions (all currently 0 tests).
- Regression: governance + kilo + product-service suites green.
- Changed-file typecheck: exit 0.
- Full-suite failure set reduced by exactly 5 (no new failures).

**Checkpoint:** `.kilo/plans/assurance-stale-test-reconciliation-checkpoint.md`

**DO-NOT-REPEAT:** do not change `Core/Engine.ts`; do not re-add `unitsSold`-required/`points`/`fitted`/`inSampleMae` APIs; do not delete the phase-09 files; do not touch `LocalFolderWatcher` or OCR in this stage.

---

## Stage 2 — `assurance.local-folder-watcher-lifecycle`

**State:** COMPLETE
**Baseline SHA:** `077dc2d0741f96374cf2959c1ce06eef0f65691b`
**Classification:** REAL PRODUCT DEFECT (process-level abort), repaired in the canonical owner — not a flake, not excluded.

**DISCOVER / INSPECT (done):**
- Isolated suite reproduced the abort deterministically: `Assertion failed: !_wcsnicmp(filename, dir, dirlen), file src\win\fs-event.c, line 72`, exit `0xC0000409`.
- Two-process inline proof: watching short `os.tmpdir()` path `C:\Users\AVALIP~1\...` **aborts**; watching the long `realpath` form `C:\Users\avalipour\...` **works (exit 0)**.
- Cause: libuv resolves event names to long form via `GetLongPathNameW` while the registered watch prefix stays short → `uv__relative_path` prefix assertion fails → `abort()`.
- `LocalFolderWatcher.start()` passed the caller's possibly-short path directly to `fs.watch`.

**Repair:** `Backend/HBOS/Product/LocalFolderWatcher.ts` — `start()` canonicalizes with `await fs.realpath(this.folder)` before `stat`/`readdir`/`watch`. Test strengthened to assert canonical `sourcePath`.

**Evidence:** focused 9/9 ×4 runs; regression 37/37; typecheck exit 0; full suite 255/259 suites / 1951/1954 tests with `LocalFolderWatcher` **PASS**. See `.kilo/plans/assurance-local-folder-watcher-lifecycle-checkpoint.md` and audit §33.

**Checkpoint:** `.kilo/plans/assurance-local-folder-watcher-lifecycle-checkpoint.md`

**DO-NOT-REPEAT:** do not permanently exclude `LocalFolderWatcher`; do not modify the protected `FinancialDataIngestionAdapter.ts`; do not change the watcher's public contract beyond canonicalization.

---

## Stage 3 — `security.auth-route-rate-limiting`

**State:** COMPLETE
**Baseline SHA:** `c422c4c01364b4c8cc2371e51f8353592b0bdc21`
**Classification:** REAL SECURITY DEFECT (unauthenticated auth entry points had no limiter; cross-route bypass possible).

**DISCOVER / INSPECT (done):**
- `CommercialRuntimeServer` applied `TokenBucketRateLimiter` only per session token, on routes handled after the `if (!session) return 401` gate.
- `POST /api/auth/register`, `POST /api/auth/login`, and `POST /api/session` execute before that gate, so they were unlimited.
- `/api/session` accepts the same password credential as `/api/auth/login`; limiting only login would leave a bypass.

**Repair:** per-client bucket (`remoteAddress`, 20 / 5 per s) checked before body read; per-identity bucket (`client + username + organization`, 5 / 1 per s) checked before credential verification and shared by `/api/auth/login` + password `/api/session`; fail-closed `429 { error: "RATE_LIMIT_EXCEEDED" }` with `Retry-After: 1` and a security event; `/api/ready` advertises `auth-rate-limiting`.

**Evidence:** focused 10/10 (login brute force, no route bypass, per-account isolation, deterministic reset, cross-identity client limit, auditable security event); integration regression 16 suites / 100 tests; typecheck exit 0; full suite 257/259 with the rate-limiting suite green under load. See `.kilo/plans/security-auth-route-rate-limiting-checkpoint.md` and audit §34.

**Checkpoint:** `.kilo/plans/security-auth-route-rate-limiting-checkpoint.md`

**DO-NOT-REPEAT:** do not create a second limiter or a parallel auth architecture; reuse `TokenBucketRateLimiter` and `CommercialIdentityService`; do not weaken the passwordless bootstrap decision gate; do not lower limits to make tests pass.

---

## Stage 4 — `product.web-password-auth`

**State:** COMPLETE
**Baseline SHA:** `0235f6cc8a96ddc7eca627666a3faff30ac29438`
**Classification:** REAL PRODUCT/USABILITY GAP (web UI exposed only passwordless bootstrap; unreachable password auth after identity hardening).

**DISCOVER / INSPECT (done):**
- `web/index.html`/`web/app.js` had a single passwordless `POST /api/session` form and no register/login/logout.
- Canonical backend `/api/auth/register|login|logout` + `CommercialIdentityService` already existed and was verified; no backend change needed.

**Repair:** real register/login forms + logout button in `web/index.html`; `refreshSessionState`/`wireAuthForm`/logout in `web/app.js` calling `GET /api/session` and `POST /api/auth/register|login|logout`; password inputs `type=password`; errors surfaced; password cleared on success.

**Evidence:** focused web suite 2/2 (register → invalid 401 → login → session → authorized `/api/sources` 200 / anonymous 401 → logout → post-logout 401); integration 16 suites / 101 tests; typecheck exit 0; full suite 256/259 (known flakes only). See `.kilo/plans/product-web-password-auth-checkpoint.md` and audit §35.

**Checkpoint:** `.kilo/plans/product-web-password-auth-checkpoint.md`

**DO-NOT-REPEAT:** do not build a parallel auth backend; do not remove the passwordless bootstrap decision gate; do not store or log plaintext credentials client-side.

---

## Stage 5 — `security.http-boundary-tenant-object-authz`

**State:** COMPLETE
**Baseline SHA:** `1f01178dd3cadf54ec140d593aa76f8cfa1c00a1`
**Classification:** DEFENSE-IN-DEPTH SECURITY GAP (canonical `TenantIsolation` unwired at HTTP; no object-level owner check on work-item reads).

**DISCOVER / INSPECT (done):**
- Object routes depended only on service-level tenant scoping; `Security/TenantIsolation.checkAccess()` was never called by the runtime.
- `GET /api/execution/work-items/:id` returned any same-tenant item to any authenticated member.

**Repair:** `enforceTenantBoundary()` invoking `TenantIsolation.checkAccess(executionContext(session), …)` on work-item, source, and report-artifact routes (fail closed 404 + `TENANT_VIOLATION` audit); `canAccessWorkItem()` enforcing creator/approver/assignee or `ADMINISTER` authority, else `403 WORK_ITEM_FORBIDDEN` + audited denial.

**Evidence:** focused execution suite 6/6; integration 18 suites / 117 tests; typecheck exit 0; full suite 257/259. See `.kilo/plans/security-http-boundary-tenant-object-authz-checkpoint.md` and audit §36.

**Checkpoint:** `.kilo/plans/security-http-boundary-tenant-object-authz-checkpoint.md`

**DO-NOT-REPEAT:** do not duplicate `TenantIsolation`; do not weaken the object owner/admin rule to pass tests; do not disclose cross-tenant existence.

---

## Stage 6 — `observability.metrics-and-request-trace`

**State:** COMPLETE
**Baseline SHA:** `06cab69faef5889a6fad541aa1e94f4e1334846e`
**Classification:** OBSERVABILITY GAP (no request correlation or operation metrics).

**Repair:** new supporting (non-Engine) `Autonomous/Runtime/RuntimeObservability.ts` with injection-safe `requestId`, bounded `normalizeRoute`, `recordRequest`, `snapshot`; runtime emits `X-Request-Id`, records every response on `res.once("finish")`, exposes privileged `GET /api/diagnostics/metrics`, and includes `requestId` in 404/error bodies.

**Evidence:** focused 5/5; integration 19 suites / 122 tests; typecheck exit 0; full suite 259/260 with only the OCR env gap (1968/1968 tests). See `.kilo/plans/observability-metrics-and-request-trace-checkpoint.md` and audit §37.

**Checkpoint:** `.kilo/plans/observability-metrics-and-request-trace-checkpoint.md`

**DO-NOT-REPEAT:** do not create an Engine; do not store or expose credentials/cookies/tokens/content in metrics; do not reflect unsafe inbound request ids.

---

## Stage 7 — `standardization.pagination-and-idempotency`

**State:** COMPLETE
**Baseline SHA:** `235efe45a333185d630d8745e14c97c541ef0828`
**Classification:** STANDARDIZATION GAP (S3 pagination; S4 idempotency).

**DISCOVER / INSPECT (done):**
- Real list routes: `GET /api/sources`, `GET /api/execution/work-items`, `GET /api/report/artifacts` (all tenant-scoped owners; `:latest`/dashboard routes are single objects).
- Real duplicate-prone mutations: `POST /api/ingest`, `POST /api/execution/work-items`, `POST /api/report/export`. Other POSTs overwrite a `:latest` key, are state-guarded, or are pure computation.
- Canonical persistence: `SQLitePersistenceStore` KV table `persistence_records` — reused, not replaced.

**Repair:** additive `QueryPagination` contract with default 50 / max 200 and fail-closed validation; paginated owner methods (`listSourcesPage`, `listWorkItemsPage`, `listPage`) with total ordering and tenant filter before slicing; `writeIfAbsent`/`delete` atomic-claim primitives; runtime `runIdempotent` with tenant+actor+route key scope, request hashing, replay (`Idempotency-Replayed`), conflict/in-progress 409, and claim release on failure; `web/app.js` sends rotating keys on the three mutations.

**Evidence:** focused pagination 8/8, focused idempotency 12/12; integration 16 suites/103 tests; persistence/rbac regression 7 suites/67 tests; typecheck exit 0; full suite **261/262 suites, 1988/1988 tests** (only E2 OCR env gap); restart-replay and cross-tenant/race cases asserted. See `.kilo/plans/standardization-pagination-and-idempotency-checkpoint.md`.

**Checkpoint:** `.kilo/plans/standardization-pagination-and-idempotency-checkpoint.md`

**DO-NOT-REPEAT:** do not build a new idempotency store/database or pagination engine; do not paginate single-object routes or add meaningless headers to overwrite/pure-compute POSTs; do not silently clamp invalid limits; do not weaken the tenant/actor key scope; do not touch `FinancialDataIngestionAdapter.ts` or `Engine.initialize()`.

---

## Self-replanning rule

After stage 1 verifies, re-audit the affected verification area, refresh this queue, and advance to the next highest-value **safe** stage automatically. Stop only on: all repository-local items VERIFIED COMPLETE; genuine EXTERNAL BLOCKER; required ARCHITECTURE CHANGE CONTROL; or a safety/integrity condition.
