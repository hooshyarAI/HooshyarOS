# Checkpoint — `assurance.local-folder-watcher-lifecycle` (real Windows/libuv native abort)

**Status:** VERIFIED — ready to commit
**Branch:** `fix/autonomous-product-factory`
**Trusted baseline:** `077dc2d0741f96374cf2959c1ce06eef0f65691b`
**Architecture:** Architecture Freeze V4.1 (unchanged)
**Classification:** REAL PRODUCT DEFECT (process-level abort) — repaired in the canonical owner
**Authority:** `.kilo/plans/ACTIVE-COMMERCIALIZATION-MASTER-LEDGER.md` §3.2 (E1); audit §33

---

## Knot

One coherent assurance knot: diagnose and repair the deterministic Node process abort produced by `LocalFolderWatcher` when a watched folder emits file events. No new engine; no architecture change; canonical owner preserved.

One capability = one owner = one implementation = one test = one commit.

## Defect (exact)

Running the isolated `LocalFolderWatcher` suite (or any write inside a watched short-path folder) hard-aborts the Node process:

```
Assertion failed: !_wcsnicmp(filename, dir, dirlen), file src\win\fs-event.c, line 72
exit -1073740791 (0xC0000409)
```

This is not a flake and not merely a test-teardown race: it reproduces deterministically in a two-process inline experiment.

### Root cause (proven)

Environment: Node `24.18.1`, libuv `1.52.1`, Windows x64.

| Watched path | Result |
|---|---|
| `os.tmpdir()` short form: `C:\Users\AVALIP~1\AppData\Local\Temp\hw-short-*` | **Abort** `fs-event.c:72`, exit `0xC0000409` |
| `fs.realpathSync.native(...)` long form: `C:\Users\avalipour\AppData\Local\Temp\hw-long-*` | Events emitted, **exit 0** |

`os.tmpdir()` returns an 8.3 short path on this host. libuv's Windows fs-event handler resolves the changed file name to its long form via `GetLongPathNameW` while the registered directory prefix (`handle->dirw`) stays short, so the `uv__relative_path` prefix assertion fails and `abort()`s the whole process. The product exposed this because `LocalFolderWatcher.start()` passed the caller-supplied path straight to `fs.watch`; a real user watching a short/`%TEMP%`-derived path would crash the entire Node process.

## Repair

`Backend/HBOS/Product/LocalFolderWatcher.ts`:

- `folder` is no longer `readonly`.
- `start()` canonicalizes with `this.folder = await fs.realpath(this.folder)` before `stat`/`readdir`/`watch`, so the libuv watch prefix matches the resolved event names.

`fs.promises.realpath` (native under the hood) resolves 8.3 short names to the long form on Windows (verified inline: `C:\Users\AVALIP~1\...` → `C:\Users\avalipour\...`).

## Behavioral test strengthening

`Backend/HBOS/test/LocalFolderWatcher.test.ts`:

- Added `promises as fsp` import.
- The "emits add for new files and change for existing" test now captures `sourcePath` and asserts it equals `join(await fsp.realpath(directory), "ledger.csv")`, locking in canonicalization so removing the fix fails cleanly instead of only aborting.

No assertion weakened; no test deleted, skipped or excluded.

## Verification

| Check | Command / artifact | Result |
|---|---|---|
| Focused (isolated) | `jest Backend/HBOS/test/LocalFolderWatcher.test.ts --runInBand` | **9/9 tests passed, exit 0** |
| Focused determinism | same suite repeated | **4/4 runs passed, no abort** |
| Regression | `FinancialDataIngestionAdapter.test.ts` + `Phase14-IngestionRuntime.test.ts` | **2/2 suites, 37/37 tests passed** |
| Changed-file typecheck | `tsc --noEmit` (2 changed files) | **exit 0** |
| Full suite | `jest --silent` → `.kilo/evidence/jest-full-stage2-localfolderwatcher-fix.txt` | **255/259 suites, 1951/1954 tests**; `LocalFolderWatcher` now **PASS** |

## Remaining failures (all pre-existing, independently classified — not caused by this knot)

| Suite | Class |
|---|---|
| `test/FinancialDataIngestionAdapter.test.ts` (XLSX SHA-256 duplicate detection) | TIMING/RESOURCE FLAKE (passes in isolation; fails only under full parallel load) |
| `test/OcrAdapter.test.ts` | ENVIRONMENT GAP (`tesseract.js` absent) |
| `test/CommercialRuntimePersistenceRecovery.test.ts` | TIMING/RESOURCE FLAKE (5 s timeout under load) |
| `Autonomous/Runtime/KiloCodeExecutionAdapter.test.ts` | TIMING/RESOURCE FLAKE (real Windows parent+child timeout; passes in isolation) |

## Changed files

- `Backend/HBOS/Product/LocalFolderWatcher.ts`
- `Backend/HBOS/test/LocalFolderWatcher.test.ts`
- `.kilo/evidence/jest-localfolderwatcher-isolated.txt` (reproduced abort, before-fix)
- `.kilo/evidence/jest-full-stage2-localfolderwatcher-fix.txt` (after-fix full suite)
- `.kilo/plans/platform-wide-commercialization-conformance-audit.md` (§33)
- `.kilo/plans/assurance-local-folder-watcher-lifecycle-checkpoint.md`
- `.kilo/plans/ACTIVE-COMMERCIALIZATION-MASTER-LEDGER.md`
- `.kilo/plans/AUTONOMOUS-COMMERCIALIZATION-EXECUTION-QUEUE.md`

## Architecture proof

No engine moved or duplicated; no `Core/Engine.ts` change; `LocalFolderWatcher` remains a supporting (non-Engine) service with the same public contract plus canonicalization; `FinancialDataIngestionAdapter` (protected) untouched; Architecture Freeze V4.1 preserved.

## Truth boundary

No change to `productComplete`, `commercialProductRuntimeComplete` or `externalProductionDependenciesComplete`. No delivered commercial capability touched. The watcher was **not** permanently excluded to make Jest green; its real coverage is preserved and strengthened.

## Next candidate knot (not executed)

`security.auth-route-rate-limiting` — apply the existing limiter to `/api/session` and `/api/auth/login`, with a negative 429 test.
