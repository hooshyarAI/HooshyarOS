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
| 8 | `assurance.ocr-environment-gap` | E2 | Resolve only if runtime contract requires; else record explicit, non-hidden gap | `OcrAdapter` | HIGH | **COMPLETE** |
| 9 | `assurance.flake-containment` | F1,F2,F3 | Analyze + contain parallel-load resource contention (measured test budgets / owner lifecycle) without hiding real failures | test files + `KiloCodeExecutionAdapter` | HIGH | **COMPLETE** |
| 10 | `standardization.architecture-doc-registry-reconciliation` | C8 | Reconcile LifecycleManager tier drift + stale dormant labels to repository truth | `Docs/ARCHITECTURE.md` | HIGH | **COMPLETE** |
| 11 | `assurance.construction-remote-attestation` | C9 | Independent GitHub-remote verification at phase end | `LocalConstructionToolset` | MEDIUM | **COMPLETE** |
| 12 | `product.offline-sync` | C1 | Wire existing `SyncStateStore` owner (no rebuild) | `Product/SyncStateStore.ts` | MEDIUM | **COMPLETE** |
| 13 | `assurance.completion-audit-integrity` | K3 | Fail-closed completion gate: require behavioral + commit-bound application/acceptance evidence; reject marker/file/regex-only completion | `CapabilityEvidenceAudit`, `CanonicalCapabilityAudit`, `CommercialProductCompletionAudit`, `AutonomousBuildDaemon` | HIGH | **COMPLETE** |
| 14 | `standardization.governance-operator-reconciliation` | K4 | Reconcile stale/incomplete governance docs to the approved local execution-operator model (docs-only, no rule change) | `Docs/HOOSHYAROS_MASTER_CHARTER.md`, `Docs/HOOSHYAROS_FINAL_DECISIONS_REGISTER.md`, `AUTONOMOUS_MISSION.md` | HIGH | **COMPLETE** |
| 15 | `productization.installed-product-acceptance` | K8 | Qualify the real installed Windows artifact end-to-end; repair the acceptance-harness launch construction (Windows quoting) without weakening the criterion | `scripts/installed-product-acceptance.cjs` | MEDIUM | **COMPLETE** |
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

## Stage 8 — `assurance.ocr-environment-gap`

**State:** COMPLETE
**Baseline SHA:** `dd4e94826a6c397df834b4e2dc3474f8d383492c`
**Classification:** ENVIRONMENT GAP / deliberately-unsupported capability.

**DISCOVER / INSPECT (done):**
- Governed contract (`Docs/Product/FinancialIngestionService.md`) declares OCR/images **deliberately NOT supported**; `SUPPORTED_INGESTION_FORMATS` excludes images; `/api/ready` advertises no OCR; the runtime never imports `OcrAdapter`.
- `tesseract.js` is absent from `node_modules` and undeclared in `package.json`.
- Only `OcrAdapter.ts` statically imported it; `ScannedPdfRouter` uses type-only imports. The failing suite was a module-load failure in a dormant reference adapter.

**Decision:** OCR is **not** required by the supported runtime. Did **not** install any dependency. Made the adapter fail closed and recorded the boundary.

**Repair:** removed the static `tesseract.js` import; added an injectable `OcrEngine` + lazy `loadTesseractEngine(loader?)` that throws `ingestion-ocr-unsupported` when absent/malformed; engine resolved before the recognition try/catch; reconciled `OcrAdapter.test.ts` to injected-engine + loader-path tests (no weakening); documented the boundary.

**Evidence:** focused 8 suites/76 tests; typecheck exit 0; full suite **261/262 suites, 1998/1999 tests** with `OcrAdapter` now passing; only the known F1 flake remains. See `.kilo/plans/assurance-ocr-environment-gap-checkpoint.md`.

**Checkpoint:** `.kilo/plans/assurance-ocr-environment-gap-checkpoint.md`

**DO-NOT-REPEAT:** do not install OCR dependencies to make a suite green; do not claim OCR support; keep the engine lazy/optional; keep `unsupported` distinct from `recognize-failed`.

---

## Stage 9 — `assurance.flake-containment`

**State:** COMPLETE
**Baseline SHA:** `2714d3f25a72d1fd138766219730bae104891c23`
**Classification:** F1 = test-budget under contention; F2 = real owner-level process-lifecycle race; F3 = non-deterministic test fixture. No architecture change.

**DISCOVER / INSPECT (done):**
- F1: isolated body **4270 ms** vs Jest default 5000 ms; `createCommercialRuntimeServer` closes `SQLitePersistenceStore` on `server.close` (`CommercialRuntimeServer.ts:523,1288`) and a keep-alive probe measured close at ~145 ms → real work, not a leak/close stall.
- F2: `streamWindowsKilo` set `spawnSync` timeout equal to the monitor's `$payload.timeout`, but the monitor's timer starts after `Start-Process` writes `kilo.pid`; isolated run showed `elapsedMs:13597` (timeout 12000) with empty `EXECUTION_FINISHED code=`, and full runs failed at `expect(fs.existsSync(pidPath)).toBe(true)`.
- F3: ExcelJS/JSZip embed generation timestamps; probe showed two independent XLSX writes are byte-equal within a second but differ across 1.5 s.

**Repair:**
- `KiloCodeExecutionAdapter.ts`: `MONITOR_TIMEOUT_GRACE_MS = 30_000`; hard kill at `timeout + grace`; `status === 124` recognised as timeout. No interface change.
- `CommercialRuntimePersistenceRecovery.test.ts`: explicit `20_000` budget; assertions unchanged.
- `FinancialDataIngestionAdapter.test.ts`: duplicate-detection fixture writes byte-identical content; production adapter and assertion untouched.

**Evidence:** focused 3 suites/34 tests ×stable (F2 ×3, F1+F3 ×3); regression 12 suites/83 tests; typecheck exit 0; full suite **262/262 suites, 1999/1999 tests, exit 0** twice (`.kilo/evidence/jest-full-stage9-flake-containment.txt`, `…-run2.txt`). See audit §40 and `.kilo/plans/assurance-flake-containment-checkpoint.md`.

**Checkpoint:** `.kilo/plans/assurance-flake-containment-checkpoint.md`

**DO-NOT-REPEAT:** do not lower the F1 budget back to the Jest default; do not re-equalize the F2 process hard kill with the monitored timeout; do not revert F3 to two independent XLSX generations; do not skip/quarantine tests, add retries, widen the whole-suite `testTimeout`, or serialize the entire suite.

---

## Stage 10 — `standardization.architecture-doc-registry-reconciliation`

**State:** COMPLETE
**Baseline SHA:** `4c067b21f9bbf2d4cdcc4bb7edb3103874142056`
**Classification:** STANDARDIZATION/DOCUMENTATION DRIFT (C8). Docs-only; no runtime behavior changed.

**DISCOVER / INSPECT (done):**
- `ARCHITECTURE.md` labels `DecisionIntelligenceEngine` "Dormant / no verified consumers / not implemented", but `Engines/DecisionIntelligenceEngine.ts:84` implements `Engine` (AHP/TOPSIS/decision-tree) with live consumers `Product/DecisionWorkbench.ts:81` and `Product/OrchestratedDecisionIntelligenceService.ts:76`.
- Canonical health engine class is `HealthMonitorEngine` (`Engines/HealthMonitorEngine.ts:19`), used by `AutonomousOperationsEngine`.
- `Engines/LifecycleManager.ts` tiers are a preferred ordering resolved against `EngineRegistry` (unregistered skipped, unknown appended); the ordering is asserted by `EngineRegistry.phase-11-1.2.test.ts`, so the code is correct and the model was simply undocumented.
- `IntelligenceEngine` (registered by `Core/HBOS.ts:178`, used by `AssistantEngine`) is a reasoning pipeline, distinct from the domain calculation engines.

**Repair (`Docs/ARCHITECTURE.md` only):** added the `IntelligenceEngine` boundary; corrected the `DecisionIntelligenceEngine` dormancy label and listed live consumers; corrected `HealthMonitorEngine` identity; rewrote the §5 `DecisionIntelligenceEngine` entry; documented the `LifecycleManager` five-tier preferred-order model. No engine/registry/route/test code changed.

**Evidence:** focused+regression 12 suites/124 tests; doc-content dependency confirmed to be existence-only; full suite **262/262 suites, 1999/1999 tests, exit 0** (`.kilo/evidence/jest-full-stage10-doc-registry-reconciliation.txt`). See audit §41 and `.kilo/plans/standardization-architecture-doc-registry-reconciliation-checkpoint.md`.

**Checkpoint:** `.kilo/plans/standardization-architecture-doc-registry-reconciliation-checkpoint.md`

**DO-NOT-REPEAT:** do not restore the `DecisionIntelligenceEngine` dormant label; do not trim/reorder `LifecycleManager` tiers to "match the registry"; do not treat tier membership as registry membership; do not edit runtime code in a documentation-reconciliation stage.

---

## Stage 11 — `assurance.construction-remote-attestation`

**State:** COMPLETE
**Baseline SHA:** `568bebdf1c1fe87091f746b9bc5b6f8bcb9fafbb`
**Classification:** GOVERNANCE / CONSTRUCTION-INTEGRITY GAP (C9). No architecture change; additive to the existing construction-plane owner.

**DISCOVER / INSPECT (done):**
- The construction `git` tool in `LocalConstructionToolset.ts` only did fetch/rebase/push and trusted the push exit code; it never proved local HEAD == remote branch HEAD (Governance Charter §16).
- `AutonomousConstructionEngine` executes the `git` tool on `FINALIZE` and blocks when it returns `ok:false`; `AutonomousBuildDaemon.ts:65` and `AutonomousConstructionBridge.ts:29` supply `createLocalConstructionTools(...)`.
- `CommercialProductCompletionAudit` inspects local files only; the local `origin/<branch>` tracking ref is cached and not authoritative.

**Repair:** exported `attestRemoteBranchParity(root, branchOverride?, runner?)` returning `localHead` / `originTrackingHead` (report-only) / independent `remoteHead` / `parity` / `status`; fail-closed `UNVERIFIED` on unavailable or malformed remote query, `FAIL` on unequal valid SHAs, `PASS` on equality. The existing `git` FINALIZE step now runs the attestation after a successful push and returns `ok:false` (`GIT_REMOTE_ATTESTATION_FAILED`) unless `PASS`. Optional injected runner enables deterministic fail-closed testing without mutating the repository.

**Evidence:** focused 13/13; construction regression 14 suites/30 tests; changed-file typecheck exit 0; real-repository acceptance **15/15 checks PASS** against the live remote (independent `ls-remote` == `rev-parse HEAD` == tracking ref = `568bebd`), including FINALIZE reject-on-FAIL / reject-on-UNVERIFIED / accept-only-on-PASS. Transcript: `.kilo/evidence/stage11-k1-remote-attestation-acceptance.txt`. See `.kilo/plans/assurance-construction-remote-attestation-checkpoint.md`.

**Checkpoint:** `.kilo/plans/assurance-construction-remote-attestation-checkpoint.md`

**DO-NOT-REPEAT:** do not derive parity from the local tracking ref; do not convert `UNVERIFIED` to `PASS`; do not remove the FINALIZE attestation barrier or weaken the equality assertion; do not build a duplicate Git engine; do not `git reset --hard`/`git clean`; do not stage unrelated worktree files.

---

## Stage 12 — `product.offline-sync`

**State:** COMPLETE
**Baseline SHA:** `8fd6f5222d2cd089817fb4d1e2a20fc922579e41`
**Classification:** REAL MISSING PRODUCT CAPABILITY (Layer 11) — the canonical `SyncStateStore` owner existed but was unwired (no runtime import, no route, no client sync, no conflict resolution).

**DISCOVER / INSPECT (done):**
- `SyncStateStore` referenced only by itself and `SyncStateStore.test.ts`; `web/sw.js` cached the app shell only and bypassed `/api/`; `web/app.js` lost uploaded work on a network failure.
- Persistence/recovery contracts already existed (`SQLitePersistenceStore`); no new persistence layer needed.

**Repair (reuse the owner, no rebuild):** additive `SyncStateStore.list()`; runtime records a durable per-(tenant, source) cursor on `/api/ingest`/`/api/analyze`, exposes tenant-scoped `GET /api/sync/state[?source=]`, advertises `offline-sync` in `/api/ready`, and serves the real client transport; `web/offline-sync.js` provides a durable offline queue, idempotent replay, server-cursor reconciliation and `server-authoritative` conflict resolution, wired into `web/app.js` (queue-on-network-loss + flush-on-reconnect), `web/index.html` and the service-worker shell.

**Evidence:** focused 4 suites/28 tests; runtime/ingestion regression 8 suites/85 tests; architecture/qualification regression 8 suites/30 tests; changed-file typecheck exit 0; real runtime + real client over real HTTP acceptance **13/13 PASS** (`.kilo/evidence/stage12-k2-offline-sync-acceptance.txt`). See `.kilo/plans/product-offline-sync-checkpoint.md`.

**Checkpoint:** `.kilo/plans/product-offline-sync-checkpoint.md`

**DO-NOT-REPEAT:** do not build a second sync store/engine or a server-side offline queue; do not derive conflict authority from client state; do not drop queued work on a transient/offline failure; do not modify `FinancialDataIngestionAdapter.ts`; do not stage unrelated worktree files.

---

## Stage 13 — `assurance.completion-audit-integrity`

**State:** COMPLETE
**Baseline SHA:** `6bf5404216fe9d1b86ef8658c2d877ca810827b7`
**Classification:** GOVERNANCE / COMPLETION-INTEGRITY GAP (K3) — the completion claim could be derived from artifact/marker/regex presence without behavioral, application or acceptance evidence.

**DISCOVER / INSPECT (done):**
- `CanonicalCapabilityAudit.complete` = roadmap present && backlog exhausted && no missing artifacts, where missing artifacts came only from `existsSync` + a method-name regex.
- `CommercialProductCompletionAudit.complete` = contract-marker strings + file/dir existence + external dependency status; no application/acceptance evidence.
- `AutonomousBuildDaemon` composed those booleans into `productComplete` and logged a claim of "independent application-level evidence" that was never checked.
- `Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md` §Evidence model requires unit, integration, application and acceptance evidence and forbids promoting level 1/2 evidence to commercial completion.
- Canonical commit-bound application/acceptance evidence already exists: `.hooshyar/web-acceptance-success.json`, `.hooshyar/security-acceptance-success.json` (produced by `product:web:acceptance` / `product:security:acceptance`).

**Repair (minimum coherent, reuse-first, no new engine):**
- `CapabilityEvidenceAudit.evaluateCompletion(CompletionEvidence)` — fail-closed gate requiring present, verified, checkpoint-fresh, unblocked unit/integration/application/acceptance evidence; named `nonCompleteReasons`; existing boolean `evaluate()` unchanged. Shared `behavioralEvidenceSatisfied()` contract helper added.
- `CanonicalCapabilityAudit` — requires real behavioral evidence per roadmap capability and exposes `nonBehavioralCapabilities`.
- `CommercialProductCompletionAudit` — requires commit-bound canonical application/acceptance evidence and exposes `applicationEvidence`, `acceptanceEvidence`, `evidenceGaps`.
- `AutonomousBuildDaemon` — the `platform-complete` path composes the canonical audit (unit/integration) with the commercial evidence (application/acceptance) through the gate; incomplete ⇒ `platform-audit-blocked` / `COMPLETION_EVIDENCE_INSUFFICIENT`; `productComplete` requires `completionIntegrity.complete`; misleading message corrected.

**Evidence:** focused **4 suites / 29 tests**; audit/runtime regression **16 suites / 44 tests**; changed-file typecheck exit 0; real-repo acceptance **19/19 PASS** (`.kilo/evidence/stage13-k3-completion-audit-integrity-acceptance.txt`). See `.kilo/plans/assurance-completion-audit-integrity-checkpoint.md` and the `post-k3` bounded re-audit.

**Checkpoint:** `.kilo/plans/assurance-completion-audit-integrity-checkpoint.md`

**DO-NOT-REPEAT:** do not restore file-existence/marker/regex-only completion; do not treat present-but-stale, unverified or blocked evidence as complete; do not remove the `COMPLETION_EVIDENCE_INSUFFICIENT` barrier or the `evaluateCompletion` gate; do not build a duplicate audit engine; do not modify `FinancialDataIngestionAdapter.ts`, the architecture freeze, or unrelated worktree files.

---

## Stage 14 — `standardization.governance-operator-reconciliation`

**State:** COMPLETE
**Baseline SHA:** `ed3c47fc5bef775f8b975add4054fa51017095d8`
**Classification:** DOCUMENTATION CONSISTENCY (K4) — stale/incomplete governance terminology. Docs-only; no runtime behavior or governance rule changed.

**DISCOVER / INSPECT (done):**
- Governance Charter §5/§10 and `Docs/ARCHITECTURE_DECISIONS/KILO_GOVERNED_OPERATOR_DECISION.md` approve Kilo Code as a local execution/operator layer subordinate to Python/GitHub/Assistant.
- Master Charter §9 names only Python/GitHub/Assistant and prohibits external coding providers; Final Decisions Register §7/§16 repeat the three-participant framing; `AUTONOMOUS_MISSION.md` states a "Python-only construction-provider enforcement" gate.
- These omissions read broader than the approved model and create an apparent contradiction with the active Governance Charter. Per K4/GC1 this is documentation drift/incompleteness plus one exclusionary "Python-only" statement — not a governance change.

**Repair (docs-only, minimum coherent):** Master Charter §8/§9/§17 now record that approved local execution operators are subordinate, replaceable mechanisms under the three authorities and are not external coding providers; Final Decisions Register §7/§16/§18 records the same invariant; `AUTONOMOUS_MISSION.md` replaces the Python-only phrasing with approved-operator enforcement. No governance rule invented or changed; source-of-truth hierarchy and Architecture Freeze V4 preserved.

**Evidence:** docs-only diff (3 files); no source/test/runtime file changed; remaining-repository grep confirms no exclusive "Python-only"/"three participants"-without-operator statements remain in governing docs. See `.kilo/plans/standardization-governance-operator-reconciliation-checkpoint.md`.

**Checkpoint:** `.kilo/plans/standardization-governance-operator-reconciliation-checkpoint.md`

**DO-NOT-REPEAT:** do not describe Kilo Code as an external coding provider or architectural authority; do not restore exclusive "Python-only"/"three participants only" wording in governing docs; do not edit runtime, tests, completion gates or architectural engines in a documentation-reconciliation stage; do not reopen K1–K3.

---

## Stage 15 — `productization.installed-product-acceptance`

**State:** COMPLETE
**Baseline SHA:** `14995d7d21b1c97a0083a9aa147793bd9fb2f5fd`
**Classification:** ACCEPTANCE-HARNESS DEFECT (K8). The installed product is correct; the harness used to qualify it was wrong.

**DISCOVER / INSPECT (done):**
- The installed product launches correctly through its real shortcut: manual `launch-hooshyar.cmd` reaches `/health` in ~1 s, and `launch-hooshyar.ps1` waits for a real `/health` success before opening the browser.
- `scripts/installed-product-acceptance.cjs` launched `launch-hooshyar.cmd` via `spawn('cmd.exe', ['/d','/s','/c', \`"${launcher}"\`])`. Node/libuv escapes the embedded quotes to `\"`, so `cmd.exe` (`/s` only strips a leading quote) received the literal command `\"…\launch-hooshyar.cmd\"`, printed `'\"…\"' is not recognized as an internal or external command`, and exited **1** without starting the product. `stdio: 'ignore'` plus a swallowed `error` event hid the cause.
- Controlled captures: quoted `cmd.exe` → health false / exit 1 / "not recognized"; unquoted `cmd.exe` → health true / exit 0 / no stderr; `spawn(launcher, [], { shell: true })` → health true / exit 0; `wscript.exe launch-hooshyar.vbs` (the real shortcut target from `installer/HooshyarOS.iss [Icons]/[Run]`) → health true / exit 0. The runtime log was untouched by the failed harness launches, proving the product was never started.

**Repair:** `scripts/installed-product-acceptance.cjs` — `launchInstalledShortcut()` now activates the real installed shortcut target `wscript.exe "<app>\launch-hooshyar.vbs"` with `cwd: installDir`; stdio is captured instead of discarded; and `launchInstalledProduct()` requires a real health success **and** a clean launcher exit (`exit.code === 0`) for both the initial launch and the restart. No product code changed; no criterion weakened; no mock introduced.

**Evidence:** focused **4 suites / 50 tests PASS** (`CommercialAcceptanceBarrier`, `InstalledProductPackagingRepair`, `PdfAcquisition`, `OfflineSyncClient`); bounded focused restart check PASS (first launch healthy 1636 ms / exit 0; restart after kill healthy 2024 ms / exit 0); full installed-product acceptance exit 0 with **16/16** checks including `restart-recovery`/`persistence` (`.kilo/evidence/stage15-k8-installed-product-acceptance.txt`, `.hooshyar/installed-product-acceptance.json`). See `.kilo/plans/stage15-k8-installed-product-acceptance-checkpoint.md`.

**Checkpoint:** `.kilo/plans/stage15-k8-installed-product-acceptance-checkpoint.md`

**DO-NOT-REPEAT:** do not launch the installed product through `cmd.exe /c "\"<path>\""`; use the real shortcut target with a single unquoted path argument. Do not discard the launcher exit code/stderr or replace the real health check with a fixed delay. Do not weaken the installed acceptance, mock the installed product, or change the launcher to compensate for a harness bug. Do not `git reset`/`clean`/`stash`; do not stage unrelated worktree files.

---

## Self-replanning rule

After stage 1 verifies, re-audit the affected verification area, refresh this queue, and advance to the next highest-value **safe** stage automatically. Stop only on: all repository-local items VERIFIED COMPLETE; genuine EXTERNAL BLOCKER; required ARCHITECTURE CHANGE CONTROL; or a safety/integrity condition.
