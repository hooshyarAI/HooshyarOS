# Post-Renewal Fresh Audit & Governed Decision Packages (2026-09-20)

**Status:** FRESH AUDIT COMPLETE — no `IMPLEMENT_NOW` / `HOST_EXECUTABLE_NOW` item remains; `GOVERNED_DECISION_REQUIRED` items recorded as bounded decision packages and kept blocked
**Branch:** `fix/autonomous-product-factory`
**HEAD at audit:** `2c751dde` (local == origin == `ls-remote`)
**Method:** fresh re-inspection of the current HEAD after the Strategic Renewal & Continuous Innovation Law; prior classifications re-verified against current code and evidence, not copied
**Architecture:** Architecture Freeze V4.1 preserved. Five canonical intelligence engines untouched. No new engine, registry, subsystem, strategy database, product runtime or parallel governance.
**Scope discipline:** this is an audit/decision record, not a capability. No pricing, entitlement, payment, encryption/key-management, identity-policy, architecture or commercialization rule was invented; no completion flag was changed; no code was written.

---

## 1. Fresh verification of the nine remaining items

Each item was re-inspected at `2c751dde`. Prior classification is **confirmed unchanged**; nothing was silently downgraded or upgraded.

| # | Item | Current-code evidence (2026-09-20) | Classification |
|---|---|---|---|
| 1 | Security-event / audit durability in the shipped runtime | `Autonomous/Runtime/start-commercial-runtime.ts:11` calls `createCommercialRuntimeServer()` with **no options**, so `options.securityEventLogger` is undefined. Every guarded path is therefore skipped: `CommercialRuntimeServer.ts:55` (optional field), `:342` (`setSecurityLogger` never called), `:614`/`:723` (local logger undefined), `:747` `logTenantViolation`, `:1129`/`:1245`/`:1268` `logAuthorizationDenial`. The canonical `Entities/SecurityEventLogger.ts` + `Entities/AuditStore.ts` (tamper-evident, append-only, hash-chained) exist but wiring them requires a persisted audit-store/file decision. | `GOVERNED_DECISION_REQUIRED` |
| 2 | Dormant duplicate identity boundary | `Auth/CommercialAuthenticationAuthorizationBoundary.ts:16` owns a second `CommercialIdentityService` with its own isolated in-memory store; the runtime constructs and uses `Product/CommercialIdentityService` directly (`CommercialRuntimeServer.ts:368`). Consolidation vs. retention is a governed identity-boundary decision. | `GOVERNED_DECISION_REQUIRED` |
| 5 | Idempotency `IN_PROGRESS` stale-claim recovery | `CommercialRuntimeServer.ts:812` `runIdempotent()` writes `status: "IN_PROGRESS"` (`:835`) and returns `409 IDEMPOTENCY_IN_PROGRESS` (`:848`) for any existing claim; there is no age/grace inspection, so a crash between claim and completion leaves the key permanently claimed. The inline contract (`:805-810`) documents fail-closed for the in-flight case; adding stale-reclaim changes the at-least-once semantics. | `GOVERNED_DECISION_REQUIRED` |
| 6 | Per-session rate-limiter map eviction | `CommercialRuntimeServer.ts:356` `rateLimiterMap` is keyed by session token; `getOrCreateRateLimiter` (`:393-400`) only inserts and never removes. Session expiry/sweep (`:377-387`) removes session rows but not their limiter buckets, so the map grows unbounded across a long-running deployment. Eviction policy (cap vs. TTL vs. session-expiry-coupled) and its observable contract are a policy decision. | `GOVERNED_DECISION_REQUIRED` |
| 7 | Unreferenced duplicate `scripts/product-web-acceptance.cjs` | `package.json` maps `product:web:acceptance` → `scripts/web-product-acceptance.cjs`; a `git grep` over tracked files finds **no reference** to `scripts/product-web-acceptance.cjs` (`NOT_NEEDED`). Deleting an orphaned tracked artifact is an owner decision, not a capability. | `GOVERNED_DECISION_REQUIRED` |
| 8 | Dual `EngineRegistry` (`Core/` vs `Engines/`) | Two registries exist: `Backend/HBOS/Core/EngineRegistry.ts` (used by `Core/HBOS.ts`; asserted by `test/CanonicalIntelligenceEngines.test.ts:2,13` "HBOS uses the canonical Core/EngineRegistry") and `Backend/HBOS/Engines/EngineRegistry.ts` (used by `AutonomousOperationsEngine`/`HealthMonitorEngine`/`LifecycleManager`). Consolidation is an explicit architecture change under Architecture Change Control. | `GOVERNED_DECISION_REQUIRED` |
| 3 | `UserManagementEngine.setPassword()` session invalidation | `Engines/UserManagementEngine.ts:272` `setPassword()` does not invalidate existing sessions. `git grep` shows only tests call it (`test/UserManagementEngine.test.ts:145`, `test/Phase13-RBAC.test.ts:93`) — there is **no HTTP route / live production path**. Latent hardening, not a live defect. | `VALIDLY_DEFERRED` |
| 4 | `/api/auth/refresh` token rotation | `CommercialRuntimeServer.ts:677` handles `/api/auth/refresh`, delegating to `identity.refreshSession` (`:679`) → `Product/CommercialIdentityService.refreshSession` (`:303`) → `UserManagementEngine.refreshSession` (`:366`), which extends `expires_at` on the **same** token. No governing document states a rotation requirement, so this is hardening (session-fixation), not a documented defect. | `VALIDLY_DEFERRED` |
| 9 | SQLite schema-migration mechanism | Engines/persistence use `CREATE TABLE IF NOT EXISTS` (e.g. `UserManagementEngine.ts:468,485`, `OrganizationModelEngine.ts:202,214`, `Entities/AuditStore.ts:83`, `Persistence/SQLiteAdapter.ts:134,219,229,242`); there is no versioned migration mechanism. No current canonical persistence-contract change requires a migration, so it is latent upgrade risk. | `VALIDLY_DEFERRED` |

**No `IMPLEMENT_NOW` or `HOST_EXECUTABLE_NOW` item exists at `2c751dde`.**

---

## 2. Bounded decision packages — `GOVERNED_DECISION_REQUIRED`

Recorded per the mission rule: do **not** decide the governance issue inside construction; record the exact decision and keep the item blocked.

### DP-1 — Security-event / audit durability in the shipped runtime

- **Exact decision required:** whether the shipped commercial runtime must wire a durable, tamper-evident security-event/audit store (and, if so, which persistence owner, retention policy, and whether it shares or separates from the 05C persistence/encryption decisions).
- **Impacted canonical boundary:** `Autonomous/Runtime/start-commercial-runtime.ts` (entrypoint options) → `CommercialRuntimeServer` security-event emission points → `Entities/SecurityEventLogger.ts` / `Entities/AuditStore.ts` persistence. Adjacent to the pending 05C persistence/encryption/key-management decisions (B1).
- **Evidence already available:** the canonical `SecurityEventLogger` + `AuditStore` implementations and their tests exist; the emission call sites are already present and guarded; the logger is fully optional today.
- **Missing information:** approval of the persistence substrate, retention, tenant-isolation-at-rest and encryption approach for audit events (05C / B1); owner of the production audit file/store.
- **Status:** BLOCKED pending the proper authority. Not implemented.

### DP-2 — Dormant duplicate identity boundary

- **Exact decision required:** whether `Auth/CommercialAuthenticationAuthorizationBoundary.ts` (second `CommercialIdentityService`, isolated in-memory store) is retired/consolidated into `Product/CommercialIdentityService`, or intentionally retained as a distinct boundary.
- **Impacted canonical boundary:** identity/authentication ownership between `Auth/*` and `Product/CommercialIdentityService`; the runtime currently uses the latter.
- **Evidence already available:** `Auth/CommercialAuthenticationAuthorizationBoundary.test.ts` exercises the boundary; `git grep` shows no runtime consumer besides tests.
- **Missing information:** approved identity-boundary consolidation decision (identity policy authority).
- **Status:** BLOCKED pending the proper authority. Not deleted (duplicate rule).

### DP-5 — Idempotency `IN_PROGRESS` stale-claim recovery

- **Exact decision required:** the stale-claim policy — grace window, whether reclaim is allowed, and the resulting at-least-once vs at-most-once tradeoff — for a claim abandoned by a crashed process.
- **Impacted canonical boundary:** `CommercialRuntimeServer.runIdempotent()` and the `IdempotencyRecord` contract (`:90-98`) over the canonical `SQLitePersistenceStore`.
- **Evidence already available:** the current contract explicitly documents fail-closed for the in-flight case; the claim record already stores `createdAt`/`tenantId`/`actorId`/`scope`/`requestHash`, so a grace-based policy is implementable once decided.
- **Missing information:** product decision on the tradeoff and the observable error/semantics for a reclaimed in-flight request.
- **Status:** BLOCKED pending the proper authority. Not implemented.

### DP-6 — Per-session rate-limiter map eviction

- **Exact decision required:** the eviction/policy contract for `rateLimiterMap` — cap-based LRU vs TTL vs coupling to session expiry — and the observable/telemetry contract that makes eviction testable without exposing internals.
- **Impacted canonical boundary:** `CommercialRuntimeServer` per-session rate limiting (`:356`, `:393-400`) and its relationship to the canonical session lifecycle sweep (`:377-387`).
- **Evidence already available:** real unbounded growth is demonstrated by inspection; the session sweep already runs on a bounded interval and could supply expiry signals; no testable seam exists today.
- **Missing information:** chosen policy, limits and observable contract.
- **Status:** BLOCKED pending the proper authority. Not implemented.

### DP-7 — Unreferenced duplicate `scripts/product-web-acceptance.cjs`

- **Exact decision required:** owner approval to delete the tracked, unreferenced duplicate (it also carries the same Windows `.cmd` launcher defect repaired elsewhere).
- **Impacted canonical boundary:** acceptance-script ownership; the canonical owner is `scripts/web-product-acceptance.cjs` (`product:web:acceptance`).
- **Evidence already available:** no tracked reference to the duplicate (including CI workflows and `package.json`); classification `NOT_NEEDED`; it is not a product-completion blocker.
- **Missing information:** explicit owner authorization to delete a tracked file.
- **Status:** BLOCKED pending the proper authority. Not deleted.

### DP-8 — Dual `EngineRegistry` consolidation

- **Exact decision required:** whether the two `EngineRegistry` implementations are consolidated into one (and which becomes canonical) or intentionally retained per architectural domain.
- **Impacted canonical boundary:** architecture/canonical engine registry ownership; `Core/HBOS.ts` and `Engines/*` consumers; asserted by `CanonicalIntelligenceEngines.test.ts`.
- **Evidence already available:** both implementations and their consumers are identified; the duality is a pre-existing, tested architectural condition.
- **Missing information:** an approved Architecture Change Control decision.
- **Status:** BLOCKED pending the proper authority. Not redesigned.

### Related governed item already recorded

- **K5 `commercial.subscription-entitlements`** — `GOVERNED_DECISION_REQUIRED`; exact missing scope already recorded in `.kilo/plans/k5-subscription-entitlements-scope-decision-2026-09-19.md`. Not reopened.
- **B1 encryption-at-rest / key management** — `BLOCKED_HUMAN_APPROVAL`; decision-readiness already recorded in `.kilo/plans/b1-encryption-at-rest-decision-readiness-2026-09-16.md`.

---

## 3. Validly deferred (preserved, not forced)

`setPassword()` session invalidation, `/api/auth/refresh` token rotation, and the SQLite schema-migration mechanism remain `VALIDLY_DEFERRED`: they are latent hardening/upgrade concerns with no live production path, no documented requirement and no current canonical persistence-contract change that requires them. They are **not** implemented solely because they appear in the ledger.

---

## 4. External / human / environment blockers (unchanged, truthful)

| ID | Classification | Blocker |
|---|---|---|
| B1 | `BLOCKED_HUMAN_APPROVAL` | 05C encryption-at-rest / key-management / secrets / backup / persistence decisions |
| B2 | `BLOCKED_EXTERNAL` | payment-provider activation (+ K5 scope) |
| B3 | `BLOCKED_EXTERNAL` | production cloud/DNS/TLS/secrets/signing resources |
| B4 | `BLOCKED_ENVIRONMENT` | JDK/Gradle/Android SDK/adb host + external Android device |
| B5 | `AVAILABLE ON THIS HOST` | satisfied here (Inno Setup 6); other build hosts require it |

No blocker was downgraded, and no external evidence was manufactured.

---

## 5. Effect on completion flags

No completion flag changed. `productComplete` remains **FALSE**: required external production dependencies (B1–B4) remain blocked and independent, and the governing commercial-completion criteria do not make it true. Adding the Strategic Renewal Law is governance documentation, not product completion, and is not claimed as such.

---

## 6. Truth boundary

This record contains classification and decision-package statements only. It does not claim any deferred item is fixed, does not claim any governed decision was made, does not claim external blockers resolved, and does not claim `productComplete=true`.

---

## 7. Deep continuation audit — bounded extension (2026-09-20; same-day, later HEAD)

Re-inspection at the deep continuation audit baseline `e2678c88` (evidence: `.kilo/evidence/deep-continuation-audit-2026-09-20.txt`) confirmed every package above unchanged and added the following **evidence-backed extensions to existing packages** (no new package, no new ledger, no implementation):

### DP-6 extension — additional unbounded in-memory maps

- `CommercialRuntimeServer.ts:412-413` (`authClientLimiters`, `authIdentityLimiters`) are insert-only exactly like `rateLimiterMap`, so the auth limiter maps also grow without bound.
- `CommercialRuntimeServer.ts:351-354` (`latestResults`, `latestWorkbenchResults`, `latestDecisionResults`, `latestAnalyticsResults`) are per-tenant caches that are only added to.
- These are the **same eviction-policy decision as DP-6** (cap/LRU vs TTL vs session-expiry coupling, plus an observable contract). Not implemented; no separate decision.

### DP-8 extension — Core/ legacy duplicate boundary beyond `EngineRegistry`

- Three `ProjectRegistry` implementations exist: `Core/ProjectRegistry.ts`, `Registry/ProjectRegistry.ts`, `Services/ProjectRegistry.ts`.
- Two `ProjectPilotEngine` implementations exist: `Core/ProjectPilotEngine.ts` and `Engines/ProjectPilotEngine.ts`. `Core/ProjectPilotEngine` is referenced only by legacy tests (`test/Autonomous.test.ts`, `test/ProjectPilot.test.ts`, `test/Insight.test.ts`); the live commercial runtime's canonical engines use `Engines/ProjectPilotEngine` → `Services/ProjectRegistry`.
- This is the **same pre-existing `Core/` vs `Engines/` architecture duality as DP-8** and is re-affirmed, not given a new decision or an independent repair. Any consolidation remains an Architecture Change Control decision.

### Latent hardening recorded (not repaired)

- `Product/SQLitePersistenceStore.ts:27` calls `JSON.parse` on the stored value without a guard; only reachable for externally corrupted rows and there is no current failure evidence.
- `Product/SQLitePersistenceStore.ts` sets no WAL/busy_timeout pragma; the runtime is a single-writer process and the schema-migration gap remains the already-deferred item 9.

### New live finding repaired (not a governance matter)

The commit-bound application/acceptance evidence (`.hooshyar/web-acceptance-success.json`, `.hooshyar/security-acceptance-success.json`) was stale after two documentation-only commits advanced HEAD past the predecessor mission's refresh. This required no governance decision and no architecture change: the canonical harnesses were re-run at the final checkpoint commit with no code change, restoring `applicationEvidence.fresh=true` and `acceptanceEvidence.fresh=true`. Root cause (ordering) and evidence are recorded in `.kilo/evidence/deep-continuation-audit-2026-09-20.txt`.
