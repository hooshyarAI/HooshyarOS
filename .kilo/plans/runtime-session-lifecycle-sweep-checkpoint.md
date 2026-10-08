# Runtime Session Lifecycle Sweep — Checkpoint

**Status:** COMPLETE / COMMITTED / PUSHED / REMOTE-PARITY VERIFIED
**Knot ID:** `runtime.session-lifecycle-sweep`
**Date:** 2026-09-16
**Branch:** `fix/autonomous-product-factory`
**Type:** bounded, non-stage, repository-local knot (no new stage, no queue reordering)
**Pre-change trusted checkpoint:** `3504ee43fe93ccef2b87b7e946788fbcab8a631d`
**Closure SHA:** `15b5b63e64c6d9fe303ec786441bbc8e119f0df8`

---

## 1. Commit / remote parity

| Field | Value |
|---|---|
| Commit SHA | `15b5b63e64c6d9fe303ec786441bbc8e119f0df8` |
| Message | `fix(runtime): schedule expired-session pruning via the canonical owner` |
| Files | `Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts`, `Backend/HBOS/test/RuntimeSessionLifecycleSweep.test.ts` |
| `git rev-parse HEAD` | `15b5b63e64c6d9fe303ec786441bbc8e119f0df8` |
| `git rev-parse origin/fix/autonomous-product-factory` | `15b5b63e64c6d9fe303ec786441bbc8e119f0df8` |
| `git ls-remote origin refs/heads/fix/autonomous-product-factory` | `15b5b63e64c6d9fe303ec786441bbc8e119f0df8` |
| Parity | **HOLDS** — local == origin tracking == independent `ls-remote` |

One implementation commit only. No engine, route, contract, persistence-schema, security or completion-gate change.

## 2. Classification

`REAL DEFECT` — the canonical session-lifecycle owner is unwired, so expired session state grows without bound.

- `Engines/UserManagementEngine.ts:391` implements `cleanupExpiredSessions()` (`DELETE FROM sessions WHERE expires_at <= ?`); `Product/CommercialIdentityService.ts:371` delegates to it.
- The only caller in the repository is `UserManagementEngine.test.ts:125` — the commercial runtime never schedules it.
- The runtime's request path deletes a session row only lazily, and only when that exact token is presented again (`CommercialIdentityService.getSession()` → `isExpired` → `deleteSession`).
- Therefore every expired row whose cookie is never replayed stays in the `sessions` table forever: unbounded disk growth and monotonically slower session lookups in a long-running deployment.

This matches the previously accepted class "canonical owner exists and is tested but is unwired in the runtime" (cf. the `SyncStateStore` / offline-sync repair).

## 3. Repair (canonical owner, minimal)

`Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts`:

- new `CommercialRuntimeOptions.sessionSweepIntervalMs` (default `DEFAULT_SESSION_SWEEP_INTERVAL_MS` = 5 min; `0` disables, for explicit test control);
- the runtime schedules `identity.cleanupExpiredSessions()` on that interval;
- the timer is `unref()`'d (can never hold the process open) and is cleared inside the existing `server.once("close", close)` handler (no handle leak — the F1/F2 flake class is deliberately avoided);
- a sweep failure is swallowed so maintenance can never take the runtime down.

No engine, route, contract, criterion or completion-gate change.

## 4. Evidence

| Check | Command | Result |
|---|---|---|
| Focused (new suite) | `jest --runTestsByPath Backend/HBOS/test/RuntimeSessionLifecycleSweep.test.ts` | **1 suite / 3 tests PASS** |
| Guard | expired row is deleted even though the token is never replayed; stale cookie then 401 | PASS |
| Guard | a still-valid session row is retained; cookie still 200 | PASS |
| Control | with the sweep disabled the expired row persists → proves the scheduled sweep is what removes it | PASS |
| Regression | 10 runtime/auth/session/persistence suites | **10 suites / 72 tests PASS** |
| Changed-file typecheck | `tsc CommercialRuntimeServer.ts`, `tsc RuntimeSessionLifecycleSweep.test.ts` | exit **0** |
| Full suite | `node ./node_modules/jest/bin/jest.js --runInBand` | **271/271 suites, 2103/2103 tests, exit 0** (baseline 270/270, 2100; +1/+3) |

The row assertion is non-destructive and canonical: `UserManagementEngine.getSessionRecord()` applies no expiry logic, so a present row proves the row was never deleted (not merely treated as expired).

Evidence artifact: `.kilo/evidence/runtime-session-lifecycle-sweep-2026-09-16.txt`.

## 5. Truth boundary

- No completion flag changed: `assistantComplete` TRUE; `canonicalPlatformConstructionComplete` FALSE; `commercialProductRuntimeComplete` FALSE; `externalProductionDependenciesComplete` FALSE; `productComplete` FALSE.
- K8 remains VERIFIED/CLOSED and was not reopened. B1 `BLOCKED_HUMAN_APPROVAL`; B2/B3 `BLOCKED_EXTERNAL`; B4 `BLOCKED_ENVIRONMENT`; B5 AVAILABLE ON THIS HOST (unchanged).
- No test weakened/skipped, no evidence fabricated. Unrelated worktree files were not staged.

## 6. Observed, not repaired (deliberately not bundled)

The in-memory per-session rate-limiter map (`CommercialRuntimeServer.rateLimiterMap`) is likewise never evicted, so it grows with the number of distinct session tokens over process lifetime. Evicting it requires a read-only session-existence seam and a separately observable proof; it is a different mechanism from the scheduled DB sweep, so it was recorded rather than bundled. Candidate for a later bounded knot.

## 7. DO-NOT-REPEAT

- Do not remove the scheduled sweep, the `unref()`, or the clear-on-close.
- Do not replace the sweep with a per-request O(n) cleanup.
- Do not assert the sweep via a destructive probe (`cleanupExpiredSessions()` return value) in a polling loop; assert non-destructively on `getSessionRecord()`.
- Do not bundle the rate-limiter-map eviction into this knot.
- Do not stage unrelated worktree files; do not `git reset`/`clean`/`stash`.
