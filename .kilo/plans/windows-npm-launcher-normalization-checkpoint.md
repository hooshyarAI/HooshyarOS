# Windows npm Launcher Normalization — Checkpoint

**Knot ID:** `assurance.windows-npm-launcher-normalization`
**Status:** COMPLETE / VERIFIED
**Date:** 2026-09-16
**Branch:** `fix/autonomous-product-factory`
**Type:** Bounded repository-local repair of the Windows `.cmd` npm-launch defect class. Not a new stage, not a new audit, no K8 reopening.
**Pre-change trusted checkpoint:** `50c76a311e1595264c4849320c9acd161070337a`
**Predecessor knot:** `assurance.commercial-application-acceptance-harness-repair` (`8e52acea`)
**Classification:** `IMPLEMENTATION_GAP` — Windows `.cmd` npm launcher defect (repaired).
**Evidence artifact:** `.kilo/evidence/assurance-windows-npm-launcher-normalization-2026-09-16.txt`

---

## 1. Commit / remote parity

| Field | Value |
|---|---|
| Pre-change trusted checkpoint | `50c76a311e1595264c4849320c9acd161070337a` |
| Knot closure commit | `2d7360167ba38d61d18f1b683db20478763575f8` — `fix(launch): normalize canonical Windows npm launchers` |
| `git rev-parse HEAD` | `2d7360167ba38d61d18f1b683db20478763575f8` |
| `git rev-parse origin/fix/autonomous-product-factory` | `2d7360167ba38d61d18f1b683db20478763575f8` |
| `git ls-remote origin refs/heads/fix/autonomous-product-factory` | `2d7360167ba38d61d18f1b683db20478763575f8` |
| Parity | **HOLDS** — local == origin tracking == independent `ls-remote` |

One implementation commit (the knot). This checkpoint file and its closure SHA are persisted by the
immediately following docs-only commit (no code change), matching the repository's existing checkpoint
persistence precedent.

## 2. Selection basis

The continuation scan searched the repository for the predecessor knot's defect class: a Windows `.cmd`/`.bat` launcher spawned with `shell: false`, which Node rejects with `EINVAL` before the child starts. Three further canonical launchers exhibited it:

| Owner | Entry point |
|---|---|
| `scripts/real-product-qualification.cjs` | npm `product:real:qualification` |
| `Backend/HBOS/Autonomous/Product/AutonomousProductFactory.ts` | npm `product:factory:contract` |
| `scripts/autonomous-ci-repair-runner.cjs` | `.github/workflows/autonomous-ci-repair.yml` |

One coherent root cause ⇒ one bounded change set with one test boundary, per the queue rule "One coherent root cause = one bounded change set = one test boundary = one commit". Each owner received the same minimal normalization; no unrelated task was combined.

## 3. Repair (minimal per owner; repository-consistent convention)

Common convention: on Windows launch the npm CLI via `process.env.ComSpec || 'cmd.exe'` with `/d /s /c "npm <args>"`; on POSIX spawn `npm` directly — the convention already used by `web-product-acceptance.cjs`, `security-tenant-acceptance.cjs`, `autonomous-factory-loop.cjs`, `FinalProductFactoryRunner.ts`, `LocalConstructionToolset.ts` and `KiloCodeExecutionAdapter.ts`.

- `scripts/real-product-qualification.cjs` — exported `launchNpm(args, stdio)` / `run(label, args)`; failures now report `exitCode`, `signal` and `launcherError`; `main()` guarded by `require.main === module`.
- `Backend/HBOS/Autonomous/Product/AutonomousProductFactory.ts` — exported `npmInvocation(args)` resolver used for the two runtime launches, `npm test`, and the `npm --version` prerequisite probe; new `stopChild()` tree-kills on Windows (`taskkill /PID <pid> /T /F`) instead of `child.kill()`, preventing a stale runtime from holding the port/database during the restart step (false-recovery risk).
- `scripts/autonomous-ci-repair-runner.cjs` — `normalizeCommand()` routes only `.cmd`/`.bat` through the command processor and leaves native executables untouched; load-time repair-context validation moved into `assertRepairContext()` called by `main()`; `main()` guarded by `require.main === module`.

No capability reordered/added/removed; no criterion weakened; no engine/runtime/architecture/completion-gate change; no completion flag changed.

## 4. Focused test set

`Backend/HBOS/test/WindowsNpmLauncherNormalization.test.ts` (7 tests, real subprocesses, no mocks): spawnable invocation for the qualification wrapper and for the CI runner; a real canonical npm script through the wrapper path; only `.cmd`/`.bat` normalized (native executables untouched); spawnable invocation for the product factory resolver; fail-closed empty args; qualification steps bind scripts `package.json` defines. Importing the modules also proves they no longer execute or exit at load time.

## 5. Verification

| Check | Result |
|---|---|
| Focused | 7/7 tests PASS |
| Regression | 3 suites / 20 tests PASS (`AutonomousProductFactory`, `CommercialApplicationAcceptanceHarness`, `CommercialAcceptanceBarrier`) |
| Typecheck | exit 0 (`AutonomousProductFactory.ts` + new test) |
| Launch proof | repaired qualification wrapper launched a real canonical acceptance step through its own path → `stage: web-acceptance, status: PASS`, exit 0 |
| Full suite | **268 suites / 2089 tests PASS** |

## 6. Application acceptance limit (recorded truthfully)

The full `product:factory:contract` journey requires a clean working tree (`gitClean()` at the AUDIT stage). This repository carries pre-existing unrelated working-tree changes that must be preserved, so the journey's end-to-end acceptance is blocked by that pre-existing environment condition — not by this knot — and was **not** fabricated. The full `product:real:qualification` wrapper was not executed end-to-end because its `factory` step clears/overwrites unrelated local `.hooshyar/` evidence before failing the clean-tree precondition; its real launch path was proven directly instead.

## 7. Completion gate state (unchanged)

| Flag | Value |
|---|---|
| `assistantComplete` | TRUE |
| `canonicalPlatformConstructionComplete` | FALSE |
| `commercialProductRuntimeComplete` | FALSE |
| `externalProductionDependenciesComplete` | FALSE |
| `productComplete` | FALSE |

## 8. Architecture Freeze V4 compliance

No engine, registry, lifecycle, memory, knowledge, decision, assistant, project-pilot, reaction, health-monitor, boot, persistence, observability, security or tenant-isolation implementation was modified. Architecture impact: **none**. Security/privacy: unchanged. Tenant isolation: unchanged. Acceptance/evidence integrity: improved — three canonical launchers can now actually start the npm CLI on Windows.

## 9. Files changed

| File | Change |
|---|---|
| `scripts/real-product-qualification.cjs` | Repaired launcher, cause surfacing, testable exports, `require.main` guard |
| `Backend/HBOS/Autonomous/Product/AutonomousProductFactory.ts` | `npmInvocation` resolver + Windows process-tree termination |
| `scripts/autonomous-ci-repair-runner.cjs` | `normalizeCommand` + `assertRepairContext` + `require.main` guard |
| `Backend/HBOS/test/WindowsNpmLauncherNormalization.test.ts` | New focused behavioral suite (7 tests) |
| `.kilo/evidence/assurance-windows-npm-launcher-normalization-2026-09-16.txt` | New knot evidence artifact |
| `.kilo/evidence/windows-npm-launcher-normalization-launch-proof-2026-09-16.txt` | Real launch-path proof transcript |
| `.kilo/evidence/jest-full-windows-npm-launcher-normalization-2026-09-16.txt` | Full-suite transcript |
| `.kilo/plans/windows-npm-launcher-normalization-checkpoint.md` | This checkpoint |
| `.kilo/plans/ACTIVE-COMMERCIALIZATION-MASTER-LEDGER.md` | Bounded delta entry |
| `.kilo/plans/AUTONOMOUS-COMMERCIALIZATION-EXECUTION-QUEUE.md` | Bounded knot entry |
| `Docs/HOOSHYAROS_MASTER_CHARTER.md` §15.1.1/§15.1.2 | Audit Memory delta |

Not staged (unrelated work preserved): `.kilo/agents/hooshyar-construction.md`, `package-lock.json`, `.kilo/kilo.jsonc.bak-*`, `dist/`, `fixtures/`, `tmp_*.js`, historical phase artifacts.

## 10. Remaining defect-class finding (recorded, not selected)

`scripts/product-web-acceptance.cjs` has the identical defect but is an **UNREFERENCED DUPLICATE** of the canonical `scripts/web-product-acceptance.cjs` (`git grep` over all tracked files including `.github/workflows/` and `package.json` finds no reference; `product:web:acceptance` maps to `web-product-acceptance.cjs`). Classification: **NOT_NEEDED** — unreachable, and it executes at load time so it has no test boundary without out-of-scope restructuring. Recommended separate owner decision: delete the duplicate. Not a product-completion blocker.

## 11. Remaining after this knot

- Human approval: **B1** 05C encryption-at-rest / key-management decisions.
- External: **B2** payment-provider activation; **B3** production cloud/DNS/TLS; code-signing (Authenticode) certificate.
- Environment/device: **B4** Android toolchain + device; **B5** AVAILABLE ON THIS HOST.
- Conditional: **K5** subscription/entitlements; **K6** Android build/test evidence; **K7** NOT_NEEDED.

## 12. DO-NOT-REPEAT

- Do not re-introduce `spawn`/`spawnSync`/`execFileSync` of `npm.cmd`/`.cmd`/`.bat` with `shell: false` on Windows.
- Do not silently collapse a launcher failure into exit code 1 (surface `error`/`signal`).
- Do not replace the Windows process-tree termination with `child.kill()` for npm-launched runtimes (stale-port false-recovery risk).
- Do not weaken or reorder the canonical qualification steps.
- Do not touch `FinancialDataIngestionAdapter.ts`, `Core/Engine.ts`, the architecture freeze, completion flags, or unrelated worktree files.
