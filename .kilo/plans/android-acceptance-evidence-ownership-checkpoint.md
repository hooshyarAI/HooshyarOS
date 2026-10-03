# Android Acceptance Evidence Ownership — Checkpoint

**Knot ID:** `assurance.android-acceptance-evidence-ownership`
**Status:** COMPLETE / VERIFIED
**Date:** 2026-09-16
**Branch:** `fix/autonomous-product-factory`
**Type:** Bounded repository-local repair of an evidence-integrity defect. Not a new stage, not a new audit, no K8 reopening.
**Pre-change trusted checkpoint:** `3ce244579ebb5497bf16c3bbaa7b4d3c99036369`
**Predecessor knot:** `assurance.windows-npm-launcher-normalization` (`3ce24457`)
**Classification:** `EVIDENCE_INTEGRITY_GAP` — the Android qualification artifact was authored by the CI workflow, not by the harness that performs the real device checks.
**Evidence artifact:** `.kilo/evidence/android-acceptance-evidence-ownership-2026-09-16.txt`

---

## 1. Commit / remote parity

| Field | Value |
|---|---|
| Pre-change trusted checkpoint | `3ce244579ebb5497bf16c3bbaa7b4d3c99036369` |
| Knot closure commit | `29ac9dab3a6470998bb8868ad4edb588927de7de` — `fix(acceptance): make the Android harness own its qualification evidence` |
| `git rev-parse HEAD` | `29ac9dab3a6470998bb8868ad4edb588927de7de` |
| `git rev-parse origin/fix/autonomous-product-factory` | `29ac9dab3a6470998bb8868ad4edb588927de7de` |
| `git ls-remote origin refs/heads/fix/autonomous-product-factory` | `29ac9dab3a6470998bb8868ad4edb588927de7de` |
| Parity | **HOLDS** — local == origin tracking == independent `ls-remote` |

One implementation commit (the knot). This checkpoint file and its closure SHA are persisted by the
immediately following docs-only commit (no code change), matching the repository's existing checkpoint
persistence precedent.

## 2. Selection basis

The continuation current-state scan followed the qualification evidence chain:
`scripts/cline-runtime-evidence-collector.cjs` marks the `android-release` qualification cell `PASS` when
`.hooshyar/android-acceptance-success.json` exists, is commit-current and is `status: PASS`
(`cline-runtime-evidence-collector.cjs:25,31,53`). That artifact was **hand-authored by
`.github/workflows/final-product-factory.yml`** with a literal `acceptance` marker list, while the canonical
harness `scripts/android-product-acceptance.sh` — the owner that actually runs `adb install`, launch,
process-liveness and foreground checks — produced no evidence at all. A caller-authored marker list is exactly
the marker-only evidence the governance/K3 evidence rule forbids, and it decoupled the artifact from the checks
that justify it. Selected as the single highest-value genuinely dependency-ready repository-local defect.

## 3. Repair (one coherent root cause ⇒ one bounded change set)

| File | Change |
|---|---|
| `scripts/android-acceptance-evidence.cjs` | **New** canonical owner of the artifact. Commands `begin` / `record <step>` / `complete` / `fail <reason>` / `verify`. Fail-closed: `begin` clears any previous result (no stale PASS inherited); `record` rejects unknown steps and refuses to append to a finished run; `complete` refuses until all 8 required real steps were recorded; `fail` deletes the artifact; `verify` rejects missing/non-PASS/incomplete/unbound artifacts. `HOOSHYAR_ANDROID_EVIDENCE_PATH` isolates the artifact in tests. |
| `scripts/android-product-acceptance.sh` | Now emits its own evidence: `begin`, one `record` after each real check (`apk-present`, `device-online`, `android-booted`, `package-manager-ready`, `apk-installed`, `launcher-start`, `process-alive`, `main-activity-visible`), then `complete`. An `ERR` trap calls `fail`, so an interrupted/failed run leaves no PASS artifact. Adds an explicit pre-flight APK existence check and env-overridable `APK`/`NODE` for device-free verification. |
| `.github/workflows/final-product-factory.yml` | Removed the hand-authored heredoc evidence step; replaced with a fail-closed validation of the harness-produced artifact (`node scripts/android-acceptance-evidence.cjs verify`). |
| `Backend/HBOS/test/AndroidAcceptanceEvidence.test.ts` | **New** focused behavioral suite (real subprocesses, real filesystem, no mocks). |

No engine, registry, lifecycle, memory, knowledge, decision, assistant, project-pilot, reaction,
health-monitor, boot, persistence, observability, security or tenant-isolation implementation was modified.
No capability reordered/added/removed; no criterion weakened; no completion flag changed.

## 4. Focused test set

`Backend/HBOS/test/AndroidAcceptanceEvidence.test.ts` (7 tests, no mocks): commit-bound `IN_PROGRESS`
artifact; unknown step rejected without changing the artifact; `complete` refused until every real step was
recorded; PASS artifact lists exactly the recorded steps; a new run clears a previous PASS; `fail` removes the
artifact and `verify` refuses a missing artifact; and a **real shell integration** — `bash
scripts/android-product-acceptance.sh` executed with a fake `adb` and a real temp APK produced its own PASS
artifact (acceptance == the 8 required steps, commit == HEAD). The shell integration runs where `bash` is
available (ubuntu CI, and this Windows host via Git Bash) and is skipped otherwise.

## 5. Verification

| Check | Result |
|---|---|
| Focused | 7/7 tests PASS (1 suite) |
| `bash -n scripts/android-product-acceptance.sh` | exit 0 |
| Workflow YAML parse (js-yaml) | valid; fabricated step gone, verification step present |
| Typecheck (changed test file) | exit 0 |
| Full suite | **269 suites / 2096 tests PASS, exit 0** (two consecutive runs; baseline 268/268, 2089/2089) |
| `npm run product:assurance` | `status: PASS`, 10 qualification cells, `productComplete: false` |
| Completion gate | `complete=false`; `applicationEvidence=application-evidence-passed` (fresh); `acceptanceEvidence=acceptance-evidence-passed` (fresh); `evidenceGaps=["external-dependency-blocked"]` |
| Qualification collector | `android-release = REQUIRES_DEVICE_EXECUTION` (no fabricated artifact exists); `web-core`/`web-business`/`win-security`/`tenant-isolation` PASS from commit-current real evidence |

## 6. Honest limitations

- No physical Android device / emulator / JDK / Gradle / Android SDK exists on this host (B4 = `BLOCKED_ENVIRONMENT`). The real device acceptance was **not** run here and is **not** claimed; the harness launch path was verified device-free through a fake `adb`, and the evidence producer is behaviorally verified.
- The Android release gate still requires the CI `android-product-acceptance` job (emulator) to pass; this knot cannot substitute for it.
- `.github/workflows/android-release.yml` contains an inline adb verification copy separate from the canonical harness that emits no evidence. Recorded, not selected (no evidence-consumer impact); a future bounded consolidation owner decision.

## 7. Completion gate state (unchanged)

| Flag | Value |
|---|---|
| `assistantComplete` | TRUE |
| `canonicalPlatformConstructionComplete` | FALSE |
| `commercialProductRuntimeComplete` | FALSE |
| `externalProductionDependenciesComplete` | FALSE |
| `productComplete` | FALSE |

## 8. Architecture Freeze V4 compliance

No engine, registry, lifecycle, memory, knowledge, decision, assistant, project-pilot, reaction,
health-monitor, boot, persistence, observability, security or tenant-isolation implementation was modified.
Architecture impact: **none**. Security/privacy: unchanged. Tenant isolation: unchanged. Acceptance/evidence
integrity: improved — the `android-release` qualification cell can no longer be satisfied by a
workflow-authored marker list.

## 9. Files changed

| File | Change |
|---|---|
| `scripts/android-acceptance-evidence.cjs` | New canonical evidence owner (fail-closed) |
| `scripts/android-product-acceptance.sh` | Harness emits its own commit-bound evidence; `ERR` trap prevents stale PASS |
| `.github/workflows/final-product-factory.yml` | Fabricated evidence step removed; harness evidence verified |
| `Backend/HBOS/test/AndroidAcceptanceEvidence.test.ts` | New focused behavioral suite (7 tests) |
| `.kilo/evidence/android-acceptance-evidence-ownership-2026-09-16.txt` | New knot evidence artifact |
| `.kilo/plans/android-acceptance-evidence-ownership-checkpoint.md` | This checkpoint |
| `.kilo/plans/ACTIVE-COMMERCIALIZATION-MASTER-LEDGER.md` | Bounded delta entry |
| `.kilo/plans/AUTONOMOUS-COMMERCIALIZATION-EXECUTION-QUEUE.md` | Bounded knot entry |
| `Docs/HOOSHYAROS_MASTER_CHARTER.md` §15.1.1/§15.1.2 | Audit Memory delta |

Not staged (unrelated work preserved): `.kilo/agents/hooshyar-construction.md`, `package-lock.json`,
`.kilo/kilo.jsonc.bak-*`, `dist/`, `fixtures/`, `tmp_*.js`, historical phase artifacts.

## 10. Remaining after this knot

- Human approval: **B1** 05C encryption-at-rest / key-management decisions.
- External: **B2** payment-provider activation; **B3** production cloud/DNS/TLS; code-signing (Authenticode) certificate.
- Environment/device: **B4** Android toolchain + device; **B5** AVAILABLE ON THIS HOST.
- Conditional: **K5** subscription/entitlements; **K6** Android build/test evidence; **K7** NOT_NEEDED.

## 11. DO-NOT-REPEAT

- Do not author qualification evidence from a CI workflow or any caller; the harness that runs the checks owns and emits the artifact.
- Do not build an acceptance artifact from a hard-coded marker list.
- Do not leave a PASS artifact in place after a failed acceptance run.
- Do not weaken or reorder the canonical Android verification steps.
- Do not modify `Docs/ARCHITECTURE.md`, the frozen engines, the completion gate or completion flags for this class of defect.
