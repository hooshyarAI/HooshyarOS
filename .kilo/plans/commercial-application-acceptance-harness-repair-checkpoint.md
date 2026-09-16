# Commercial Application Acceptance Harness Repair — Checkpoint

**Knot ID:** `assurance.commercial-application-acceptance-harness-repair`
**Status:** COMPLETE / VERIFIED (commit + push parity recorded in §1)
**Date:** 2026-09-16
**Branch:** `fix/autonomous-product-factory`
**Type:** Bounded repository-local repair of a REAL acceptance-harness defect. Not a new stage, not a new audit, no K8 reopening.
**Pre-change trusted checkpoint:** `f132d1de4f427b3886b94d72f872340caaae77b7`
**Classification:** `IMPLEMENTATION_GAP` — acceptance-harness launcher defect on Windows (repaired).
**Evidence artifact:** `.kilo/evidence/assurance-commercial-application-acceptance-harness-repair-2026-09-16.txt`

---

## 1. Commit / remote parity

| Field | Value |
|---|---|
| Pre-change trusted checkpoint | `f132d1de4f427b3886b94d72f872340caaae77b7` |
| Knot closure commit | recorded in the follow-up checkpoint-persistence commit; verified by `git rev-parse HEAD` == `git rev-parse origin/fix/autonomous-product-factory` == `git ls-remote origin refs/heads/fix/autonomous-product-factory` |
| Parity | **HOLDS** — local == origin tracking == independent `ls-remote` |

One implementation commit. The follow-up commit persists this closure SHA only (no code change).

## 2. Selection basis (how this knot was found)

The registered knots are exhausted: K1–K4 VERIFIED, K8 VERIFIED, K5 `CONDITIONAL`, K6 `BLOCKED`, K7 `NOT_NEEDED`, B1–B5 blocked/conditional. A governed current-state scan was therefore executed (full suite, product assurance, completion gate, canonical capability audit, host probes, acceptance harnesses). During that scan the previously recorded K3 bounded observation was re-verified as a **live, reproducible defect** and promoted to a knot, as the continuation mandate requires:

- Master Charter §15.1.1 (Audit Memory): *"`scripts/commercial-application-acceptance.cjs` cannot launch its nested `npm run` steps on this Windows host (nested `spawnSync('npm.cmd', …, { shell: false })` produces no output, exit 1) … recorded, not silently modified."*
- `.kilo/plans/post-k3-bounded-reaudit-2026-09-14.md` §8: same observation, recorded as *"no new knot"*.

## 3. Defect reproduced at `f132d1de`

`node scripts/commercial-application-acceptance.cjs` → exit **1**:

```json
{
  "type": "COMMERCIAL_APPLICATION_ACCEPTANCE_FAILURE",
  "version": 1,
  "status": "BLOCKED",
  "repositoryCommit": "f132d1de4f427b3886b94d72f872340caaae77b7",
  "failedCapability": "web-application",
  "script": "product:web:acceptance",
  "exitCode": 1,
  "completed": []
}
```

The committed local artifact `.hooshyar/commercial-application-acceptance.json` carried the same BLOCKED shape bound to `6bf5404216fe9d1b86ef8658c2d877ca810827b7`, proving the defect was long-standing.

## 4. Root cause (proven)

`spawnSync('npm.cmd', […], { shell: false })` → Node reports `EINVAL` before the child starts, so `result.status` is `null`, the `?? 1` fallback produced exit 1, and the ignored `result.error` hid the cause. Fresh host probe:

```
shell:false npm.cmd  -> status null  error EINVAL
shell:true  npm      -> status 0     error undefined
cmd.exe /d /s /c npm -> status 0     error undefined
```

## 5. Repair (one canonical owner, minimum coherent change)

Owner: `scripts/commercial-application-acceptance.cjs` (npm `product:commercial:acceptance`). Evidence path, evidence schema, capability list and exit semantics are unchanged.

- npm is launched through the platform command processor on Windows (`process.env.ComSpec || 'cmd.exe'` + `/d /s /c "npm <args>"`), the convention already used by `scripts/web-product-acceptance.cjs`, `scripts/security-tenant-acceptance.cjs`, `scripts/autonomous-factory-loop.cjs` and `scripts/autonomous-ci-repair-loop.cjs`; POSIX spawns `npm` directly.
- The launcher no longer hides the cause: spawn errors surface as `launcherError` and abnormal signals as `signal` in the failure artifact (K8 lesson: never discard the launcher exit code/stderr).
- `runScript` validates against the fixed canonical script list and fails closed with `COMMERCIAL_ACCEPTANCE_UNKNOWN_SCRIPT`.
- `main()` is guarded by `require.main === module`; the launch helpers are exported so the real launch path is behaviorally testable.

No capability was reordered/added/removed, no criterion weakened, no product/runtime/engine/architecture/completion-gate code changed.

## 6. Focused test set

`Backend/HBOS/test/CommercialApplicationAcceptanceHarness.test.ts` (6 tests, real subprocesses, no mocks): npm CLI launch on this host; a real canonical npm script through the same path; a real child failure surfaced as an exit code (not a launcher error); fail-closed unknown script; capability binding matches `package.json`; import does not execute the acceptance chain.

## 7. Verification

| Check | Result |
|---|---|
| Focused | 6/6 tests PASS |
| Regression | 3 suites / 22 tests PASS (`CommercialAcceptanceBarrier`, `InstalledProductPackagingRepair`, `CommercialWebEntrypoint`) |
| Typecheck (changed test file) | exit 0 |
| End-to-end | `status: PASS`, exit 0, `checks: ["web-application","pdf-acquisition","security-application"]`, bound to `f132d1de` |
| Full suite | **267 suites / 2082 tests PASS** (pre-change baseline 266 / 2076) |

Real application/acceptance evidence refreshed against the current HEAD: `.hooshyar/web-acceptance-success.json` (PASS, 35 acceptance steps) and `.hooshyar/security-acceptance-success.json` (PASS, 15 acceptance steps), both commit-bound to `f132d1de`.

## 8. Completion gate state (authoritative)

- `CommercialProductCompletionAudit`: `complete=false`; `applicationEvidence=application-evidence-passed` (fresh); `acceptanceEvidence=acceptance-evidence-passed` (fresh); `evidenceGaps=["external-dependency-blocked"]`; blocked = `payment-provider-activation`, `production-cloud-resources`.
- `CanonicalCapabilityAudit`: `complete=true`; `backlogExhausted=true`; `missingArtifacts=[]`; `nonBehavioralCapabilities=[]`.
- The only remaining commercial non-completion reason is the truthful external dependency block (B2/B3). No completion flag changed.

| Flag | Value |
|---|---|
| `assistantComplete` | TRUE |
| `canonicalPlatformConstructionComplete` | FALSE |
| `commercialProductRuntimeComplete` | FALSE |
| `externalProductionDependenciesComplete` | FALSE |
| `productComplete` | FALSE |

## 9. Architecture Freeze V4 compliance

No engine, registry, lifecycle, memory, knowledge, decision, assistant, project-pilot, reaction, health-monitor, boot, persistence, observability, security or tenant-isolation implementation was modified. The change is confined to one acceptance harness script and one new focused test. Architecture impact: **none**. Security/privacy: unchanged (no credential, secret or data-path change). Tenant isolation: unchanged. Acceptance/evidence integrity: improved — the canonical combined harness can now produce real PASS evidence instead of a permanent BLOCKED artifact.

## 10. Files changed

| File | Change |
|---|---|
| `scripts/commercial-application-acceptance.cjs` | Repair: canonical Windows npm launch, cause surfacing, testable exports, `require.main` guard |
| `Backend/HBOS/test/CommercialApplicationAcceptanceHarness.test.ts` | New focused behavioral regression suite (6 tests) |
| `.kilo/evidence/assurance-commercial-application-acceptance-harness-repair-2026-09-16.txt` | New knot evidence artifact |
| `.kilo/evidence/commercial-application-acceptance-repair-2026-09-16.txt` | Raw end-to-end PASS transcript |
| `.kilo/evidence/jest-full-commercial-acceptance-harness-repair-2026-09-16.txt` | Full-suite transcript after repair |
| `.kilo/evidence/jest-full-continuation-2026-09-16.txt` | Full-suite transcript before repair (baseline) |
| `.kilo/plans/commercial-application-acceptance-harness-repair-checkpoint.md` | This checkpoint |
| `.kilo/plans/ACTIVE-COMMERCIALIZATION-MASTER-LEDGER.md` | Bounded delta entry + next-action reconciliation |
| `.kilo/plans/AUTONOMOUS-COMMERCIALIZATION-EXECUTION-QUEUE.md` | Bounded knot entry |
| `Docs/HOOSHYAROS_MASTER_CHARTER.md` §15.1.1/§15.1.2 | Audit Memory delta + K3 observation closure |

Not staged (unrelated work preserved): `.kilo/agents/hooshyar-construction.md`, `package-lock.json`, `.kilo/kilo.jsonc.bak-*`, `dist/`, `fixtures/`, `tmp_*.js`, historical phase artifacts.

## 11. Remaining after this knot

- Remaining dependency-ready repository-local implementation knots: **none**.
- Human approvals: **B1** 05C encryption-at-rest / key-management decisions.
- External blockers: **B2** payment-provider activation; **B3** production cloud/DNS/TLS; code-signing (Authenticode) certificate.
- Environment/device: **B4** Android toolchain (JDK/Gradle/Android SDK/adb) + external device; **B5** AVAILABLE ON THIS HOST.
- Conditional: **K5** subscription/entitlements (approved scope unconfirmed); **K6** Android build/test evidence; **K7** runtime-server unit coverage NOT_NEEDED.

## 12. DO-NOT-REPEAT

- Do not re-introduce `spawnSync('npm.cmd', …, { shell: false })`.
- Do not discard the launcher exit code, signal or spawn error.
- Do not rebuild a second combined acceptance framework; this script is the canonical aggregate wrapper.
- Do not weaken or reorder the three canonical capability checks.
- Do not touch `FinancialDataIngestionAdapter.ts`, `Core/Engine.ts`, the architecture freeze, completion flags, or unrelated worktree files.
