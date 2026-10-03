# Android Acceptance — Single Canonical Owner in CI — Checkpoint

**Knot ID:** `standardization.android-acceptance-single-owner`
**Status:** COMPLETE / VERIFIED
**Date:** 2026-09-16
**Branch:** `fix/autonomous-product-factory`
**Type:** Bounded repository-local standardization of the Android acceptance CI callers. Not a new stage, not a new audit, no K8 reopening.
**Pre-change trusted checkpoint:** `f18a9533c217cbe02b40734fe8b9c863f031995e`
**Predecessor knot:** `assurance.test-reference-integrity` (`f18a9533`)
**Classification:** `STANDARDIZATION_GAP` — two CI callers duplicated the canonical Android acceptance harness and had already drifted from it.
**Evidence artifact:** `.kilo/evidence/android-acceptance-single-owner-2026-09-16.txt`

---

## 1. Commit / remote parity

| Field | Value |
|---|---|
| Pre-change trusted checkpoint | `f18a9533c217cbe02b40734fe8b9c863f031995e` |
| Knot closure commit | `a2d4da65e9d0a64cdbc4811c909601bdfd8a51ab` — `fix(ci): route every Android acceptance job through the canonical harness` |
| `git rev-parse HEAD` | `a2d4da65e9d0a64cdbc4811c909601bdfd8a51ab` |
| `git rev-parse origin/fix/autonomous-product-factory` | `a2d4da65e9d0a64cdbc4811c909601bdfd8a51ab` |
| `git ls-remote origin refs/heads/fix/autonomous-product-factory` | `a2d4da65e9d0a64cdbc4811c909601bdfd8a51ab` |
| Parity | **HOLDS** — local == origin tracking == independent `ls-remote` |

One implementation commit (the knot). This checkpoint file and its closure SHA are persisted by the
immediately following docs-only commit (no code change), matching the repository's existing checkpoint
persistence precedent.

## 2. Selection basis

After `assurance.android-acceptance-evidence-ownership` made `scripts/android-product-acceptance.sh` the
owner of commit-bound Android acceptance evidence, the scan of every CI caller found two workflows still
carrying their own inline copy of the adb install/launch/liveness verification:

| Caller | Divergence from the canonical harness |
|---|---|
| `.github/workflows/android-release.yml` | no explicit `state=device` / `sys.boot_completed` wait; shorter Package-Manager and pidof budgets |
| `.github/workflows/release-artifacts.yml` | same inline copy, same omissions |

Duplicated acceptance logic in callers can silently diverge from the single canonical owner that produces the
qualification evidence. One coherent root cause ⇒ one bounded change set.

## 3. Repair

| File | Change |
|---|---|
| `.github/workflows/android-release.yml` | inline adb block replaced with `script: bash scripts/android-product-acceptance.sh` |
| `.github/workflows/release-artifacts.yml` | inline adb block replaced with `script: bash scripts/android-product-acceptance.sh` |

No verification step was weakened: the canonical harness is strictly stronger (device + boot wait, package
manager readiness, install, launch, process liveness, MainActivity foreground) and additionally emits
commit-bound acceptance evidence. No gate removed or relaxed; no engine/runtime/architecture/completion-gate
change; no completion flag changed.

## 4. Verification

| Check | Result |
|---|---|
| YAML parse (js-yaml) of both workflows | valid |
| `git grep "scripts/android-product-acceptance.sh" -- .github/workflows` | 3 callers: `android-release.yml:50`, `final-product-factory.yml:126`, `release-artifacts.yml:82` |
| `git grep "adb install -r android/app/build" -- .github/workflows` | no matches (all inline copies removed) |
| Reference-integrity guard | `TestReferenceIntegrity.test.ts` **2/2 PASS** |
| `npm run product:assurance` | `status: PASS`, `productComplete: false` |
| Full suite | **270 suites / 2098 tests PASS, exit 0** |

## 5. Honest limitations

- No Android emulator / JDK / Gradle / device exists on this host (B4 = `BLOCKED_ENVIRONMENT`), so the two workflows were **not** executed here. Their referenced owner is the canonical harness, which the predecessor knot verified behaviorally device-free (a real subprocess run with a fake `adb` produced its own PASS evidence) and which `final-product-factory.yml` already invokes. The emulator execution remains the CI gate.
- This knot changes only which harness the CI callers run; the harness itself is unchanged from the predecessor knot.

## 6. Completion gate state (unchanged)

| Flag | Value |
|---|---|
| `assistantComplete` | TRUE |
| `canonicalPlatformConstructionComplete` | FALSE |
| `commercialProductRuntimeComplete` | FALSE |
| `externalProductionDependenciesComplete` | FALSE |
| `productComplete` | FALSE |

## 7. Architecture Freeze V4 compliance

No engine, registry, lifecycle, memory, knowledge, decision, assistant, project-pilot, reaction,
health-monitor, boot, persistence, observability, security or tenant-isolation implementation was modified.
Architecture impact: **none**. Security/privacy: unchanged. Tenant isolation: unchanged.
Acceptance integrity: improved — every Android CI acceptance path now runs the single canonical, evidence-producing owner.

## 8. Files changed

| File | Change |
|---|---|
| `.github/workflows/android-release.yml` | Routes the emulator acceptance through the canonical harness |
| `.github/workflows/release-artifacts.yml` | Routes the emulator acceptance through the canonical harness |
| `.kilo/evidence/android-acceptance-single-owner-2026-09-16.txt` | New knot evidence artifact |
| `.kilo/plans/android-acceptance-single-owner-checkpoint.md` | This checkpoint |
| `.kilo/plans/ACTIVE-COMMERCIALIZATION-MASTER-LEDGER.md` | Bounded delta entry |
| `.kilo/plans/AUTONOMOUS-COMMERCIALIZATION-EXECUTION-QUEUE.md` | Bounded knot entry |
| `Docs/HOOSHYAROS_MASTER_CHARTER.md` §15.1.1/§15.1.2 | Audit Memory delta |

Not staged (unrelated work preserved): `.kilo/agents/hooshyar-construction.md`, `package-lock.json`,
`.kilo/kilo.jsonc.bak-*`, `dist/`, `AuditOutput/`, `fixtures/`, `tmp_*.js`, historical phase artifacts.

## 9. Remaining after this knot

- Human approval: **B1** 05C encryption-at-rest / key-management decisions.
- External: **B2** payment-provider activation; **B3** production cloud/DNS/TLS; code-signing (Authenticode) certificate.
- Environment/device: **B4** Android toolchain + device; **B5** AVAILABLE ON THIS HOST.
- Conditional: **K5** subscription/entitlements; **K6** Android build/test evidence; **K7** NOT_NEEDED.
- Recorded, not selected: `scripts/product-web-acceptance.cjs` (unreferenced duplicate, `NOT_NEEDED`); pre-existing dual `EngineRegistry` (`Core/` vs `Engines/`) whose consolidation is a governed architecture change.

## 10. DO-NOT-REPEAT

- Do not re-introduce an inline adb install/launch verification block in any workflow; call the canonical harness.
- Do not weaken the canonical Android verification steps or the evidence emission contract.
- Do not modify engines, the architecture freeze, the completion gate or completion flags for this class of defect.
