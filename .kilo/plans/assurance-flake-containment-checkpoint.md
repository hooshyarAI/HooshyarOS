# Stage 9 Checkpoint — `assurance.flake-containment`

**Branch:** `fix/autonomous-product-factory`
**Baseline SHA:** `2714d3f25a72d1fd138766219730bae104891c23`
**Status:** COMPLETE / VERIFIED (root causes proven; narrow containment; full suite green twice)
**Architecture:** Architecture Freeze V4.1 — no Engine created, no frozen interface changed, no dependency installed, no architecture change.

---

## 1. Scope

Contain the three remaining parallel-load nondeterminisms (F1, F2, F3) without hiding real failures:

- F1 `Backend/HBOS/test/CommercialRuntimePersistenceRecovery.test.ts`
- F2 `Backend/HBOS/Autonomous/Runtime/KiloCodeExecutionAdapter.test.ts` (+ its canonical owner `KiloCodeExecutionAdapter.ts`)
- F3 `Backend/HBOS/test/FinancialDataIngestionAdapter.test.ts` (XLSX duplicate-detection SHA-256)

No test was skipped, quarantined, deleted, or weakened. No assertion was relaxed. No Jest timeout was raised blindly. No dependency was installed.

---

## 2. Root causes (evidence-first)

### F1 — real server integration test exceeds Jest's default 5 s budget

- Isolated focused run: test body **4270 ms** (`√ … (4270 ms)`), i.e. intrinsically ~85 % of Jest's default 5000 ms.
- Full-run evidence (`.kilo/evidence/jest-full-stage8-ocr-boundary.txt`): `thrown: "Exceeded timeout of 5000 ms for a test."` at suite wall 5.831 s. No product hang: the same test passes reliably isolated.
- Resource lifecycle checked: `createCommercialRuntimeServer` installs `server.once("close", () => persistence.close())` (`CommercialRuntimeServer.ts:523,1288`), so `SQLitePersistenceStore` (Node `node:sqlite`, not a native npm module) is released on `server.close()`. A keep-alive probe showed `server.close()` costs ~145 ms, so the budget is consumed by real work (two runtime graphs, scrypt/KDF sessions, SQLite writes, HTTP round-trips), not by close waiting.
- Classification: **test-budget under contention**, not a product defect.

### F2 — process hard-kill budget raced the monitor's monitored timeout

- `streamWindowsKilo` launched the monitor with `spawnSync(..., { timeout })` while the monitor measures its own `$payload.timeout` **from after `Start-Process`** (which is also where it writes `kilo.pid`). With both budgets equal, the hard kill can fire during process startup — before the pid file exists.
- Isolated run showed this directly: adapter reported `event:"EXECUTION_TIMEOUT", code:124, elapsedMs:13597` with `timeout=12000`, and the monitor logged `EXECUTION_FINISHED code=` (empty) — the monitor was pre-empted, its `taskkill /T /F` + `exit 124` path never completed.
- Full-run evidence (`.kilo/evidence/jest-full-stage1.txt:124`): `expect(fs.existsSync(pidPath)).toBe(true)` → `Received: false`.
- Classification: **real owner-level lifecycle race** (also a latent orphan/observability weakness: a slow start could leave the launched tree unkilled and the finish code unreported).

### F3 — XLSX fixtures are not byte-deterministic between wall-clock seconds

- ExcelJS writes `Workbook.created`/`modified` (default `new Date()`) into `docProps/core.xml`, and JSZip sets per-entry ZIP DOS timestamps at generation time.
- Bounded probe: two independently generated "identical" XLSX files were byte-equal when written in the same second and **differed across a 1.5 s gap**; byte diff localized to ZIP header time fields (`0x2b13` vs `0x2b15`) plus core.xml timestamps.
- Full-run evidence (`.kilo/evidence/jest-full-stage2-localfolderwatcher-fix.txt:33`): `same XLSX content produces same SHA-256` → different SHA-256. The trailing `EPERM` on the temp-dir `afterEach` is **derived**: the assertion throws before `database.close()`, so the dir cannot be removed.
- Classification: **invalid test premise** (independent byte generation is not deterministic); the product correctly hashes raw bytes.

---

## 3. Containment (smallest complete change)

**Modified**
- `Backend/HBOS/Autonomous/Runtime/KiloCodeExecutionAdapter.ts` — F2: added `MONITOR_TIMEOUT_GRACE_MS = 30_000`; the `spawnSync` hard kill now runs at `timeout + MONITOR_TIMEOUT_GRACE_MS` so the monitor's own timeout path (pid file → `taskkill /T /F` → `exit 124`) always completes, and the adapter now also recognises the monitor's canonical `status === 124` as a timeout (`const timedOut = hardKilled || child.status === 124`). No interface change to `KiloExecutionResult`/`KiloCommand`.
- `Backend/HBOS/test/CommercialRuntimePersistenceRecovery.test.ts` — F1: explicit `20_000` test budget, matching the repository convention already used by other real runtime integration suites (`CommercialRuntimeServer.rateLimiting`, `RuntimeObservability`, `OrganizationalExecutionRuntime`, `RuntimeIdempotency`). Assertions unchanged.
- `Backend/HBOS/test/FinancialDataIngestionAdapter.test.ts` — F3: the duplicate-detection fixture now writes byte-identical XLSX content (`writeFileSync(sourcePath2, readFileSync(sourcePath1))`) instead of two independent writes. The `FinancialDataIngestionAdapter.ts` **production owner was not modified**; the assertion (`result1.evidence.sha256 === result2.evidence.sha256`) is unchanged and still exercises real two-file duplicate detection.

**Added**
- `.kilo/evidence/jest-full-stage9-flake-containment.txt`
- `.kilo/evidence/jest-full-stage9-flake-containment-run2.txt`
- `.kilo/plans/assurance-flake-containment-checkpoint.md`

---

## 4. Verification evidence

| Check | Command | Result |
|---|---|---|
| Focused F1+F2+F3 (in-band) | jest 3 suites `--runInBand` | **3/3 suites, 34/34 tests passed** |
| F2 repeat stability | jest F2 `--runInBand` ×3 | **5/5 passed ×3**; monitor now logs `[KILO] EXECUTION_TIMEOUT` (clean timeout path) |
| F1+F3 repeat stability | jest 2 suites `--runInBand` ×3 | **29/29 passed ×3** |
| Relevant regression | 12 suites (Kilo ×3, runtime e2e/business-flow/resilience/rate-limiting/observability/idempotency, Phase14 ingestion, co-located ingestion test) | **12/12 suites, 83/83 tests passed** |
| Changed-file typecheck | `tsc --noEmit` (3 changed files) | **exit 0** |
| Full suite run 1 | `jest --silent` → `.kilo/evidence/jest-full-stage9-flake-containment.txt` | **262/262 suites, 1999/1999 tests passed, exit 0** |
| Full suite run 2 | `jest --silent` → `.kilo/evidence/jest-full-stage9-flake-containment-run2.txt` | **262/262 suites, 1999/1999 tests passed, exit 0** |

The full suite is now **green with zero failures and zero skipped tests**.

### Residual observation (non-failing, pre-existing)

Both full runs still emit Jest's `A worker process has failed to exit gracefully and has been force exited` warning (also present in the Stage 8 evidence at line 305). It does not fail any suite or test and is not introduced by this stage; it is recorded here rather than silently ignored or expanded into unrelated scope.

---

## 5. DO-NOT-REPEAT

- Do not lower the F1 budget back to the Jest default; its isolated body is ~4.3 s.
- Do not set the F2 process hard kill equal to the monitored timeout again; the monitor's pid-file/tree-kill/`exit 124` contract depends on the grace window.
- Do not revert F3 to two independent XLSX generations; XLSX bytes embed timestamps and are not reproducible across seconds.
- Do not install dependencies, skip/quarantine tests, add retries, weaken assertions, widen the whole-suite `testTimeout`, or serialize the entire suite.

---

## 6. Truth boundary

- `productComplete`, `commercialProductRuntimeComplete`, `externalProductionDependenciesComplete` unchanged.
- No Engine added, no frozen contract altered, Architecture Freeze V4.1 preserved.
- No test hidden, weakened, skipped, or deleted; no assertion relaxed; no fabricated evidence.
