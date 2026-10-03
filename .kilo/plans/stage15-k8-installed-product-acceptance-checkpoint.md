# Stage 15 — K8 `productization.installed-product-acceptance` — Checkpoint

**Status:** COMPLETE / VERIFIED
**Knot:** K8 `productization.installed-product-acceptance` (Stage 15)
**Branch:** `fix/autonomous-product-factory`
**Pre-change trusted checkpoint (baseline HEAD):** `14995d7d21b1c97a0083a9aa147793bd9fb2f5fd`
**Classification:** ACCEPTANCE-HARNESS DEFECT — the product is correct; the installed-product acceptance harness was wrong.
**Product code changed:** none. **Canonical owner repaired:** `scripts/installed-product-acceptance.cjs`.

---

## 1. Resumed condition (evidence of the interruption)

The prior K8 run compiled the isolated installer successfully but stopped at the
restart/recovery check and recorded:

```json
{ "type": "INSTALLED_PRODUCT_ACCEPTANCE", "status": "BLOCKED",
  "error": "installed runtime did not recover after restart" }
```

Failure evidence: `.kilo/evidence/stage15-k8-installed-product-acceptance.txt`
(captured 2026-09-15 10:41:03). A direct/manual launch of the installed
`launch-hooshyar.cmd` reached `/health` in ~1s, while the harness spawn path exited 1.

## 2. Exact root cause — Windows command quoting in the harness

`scripts/installed-product-acceptance.cjs` launched the installed product with:

```js
spawn('cmd.exe', ['/d', '/s', '/c', `"${launcher}"`], { cwd: installDir, stdio: 'ignore', windowsHide: true });
```

On Windows, Node/libuv escapes the embedded double quotes in the argument to
`\"`, so `cmd.exe` receives:

```
cmd.exe /d /s /c \"C:\Users\<user>\AppData\Local\Programs\HooshyarOS-Acceptance\launch-hooshyar.cmd\"
```

Because `/s` only strips the outer quotes when the first character after `/c` is a
quote (here it is `\`), `cmd.exe` treats the literal `\"...\"` as the program name
and fails:

```
'\"C:\Users\avalipour\AppData\Local\Programs\HooshyarOS-Acceptance\launch-hooshyar.cmd\"'
 is not recognized as an internal or external command, operable program or batch file.
```

`cmd.exe` exits **1** and the launcher never runs. The harness `stdio: 'ignore'`
and swallowed `error` event hid this completely, so the only observable symptom
was `installed runtime did not recover after restart`.

### Reproduction captures (harness path, controlled)

| Invocation | Health | Launcher exit | stderr |
|---|---|---|---|
| `cmd.exe /d /s /c "…\launch-hooshyar.cmd"` (quoted, previous harness) | **false** | `1` | `'\"…launch-hooshyar.cmd\"' is not recognized…` |
| `cmd.exe /d /s /c …\launch-hooshyar.cmd` (unquoted) | true | `0` | — |
| `spawn(launcher, [], { shell: true })` | true | `0` | — |
| `wscript.exe …\launch-hooshyar.vbs` (real shortcut target) | true | `0` | — |

The auto-refreshing runtime log was unchanged across both failed harness attempts
(it still held the prior manual start line), proving the product was never
started by the harness — the failure was not a runtime, persistence, port or
restart race.

The product launcher itself is correct and is unchanged: `launch-hooshyar.ps1`
starts the bundled runtime and waits for a real `/health` success before opening
the browser (asserted by `InstalledProductPackagingRepair.test.ts`).

## 3. Repair (smallest canonical owner — the harness)

`scripts/installed-product-acceptance.cjs`:

- `launchInstalledShortcut()` now activates the **real installed shortcut target**
  used by `installer/HooshyarOS.iss` `[Icons]`/`[Run]`:
  `wscript.exe "<app>\launch-hooshyar.vbs"` with `cwd: installDir`. A single
  unquoted path argument has no cmd.exe quoting ambiguity.
- stdio is captured (`['ignore','pipe','pipe']`) instead of discarded, and
  `waitLauncherExit()` records exit code/signal/stdout/stderr.
- new `launchInstalledProduct(label)` requires **both** a real `/health` success
  and a clean launcher exit (`exit.code === 0`); a non-zero launcher exit or a
  launcher that never starts the product is a genuine acceptance failure. No
  fixed delay is used.
- the first launch and the restart in `verifyRestartRecovery()` both go through
  `launchInstalledProduct()`, so the real customer shortcut path is exercised
  before and after the restart.

Nothing in the acceptance criterion was weakened; the check is now stricter
(health **and** launcher exit semantics) and closer to the real customer journey
(the actual shortcut target), not further from it.

## 4. Focused verification

`Backend/HBOS/test/CommercialAcceptanceBarrier.test.ts` gained an
`installed-product acceptance harness — real shortcut launch (K8)` describe block
asserting the harness uses `launch-hooshyar.vbs` via `spawn('wscript.exe'` with
`cwd: installDir`, never re-introduces `spawn('cmd.exe'`, and requires real
health plus `exit.code !== 0` failure handling.

Focused K8 suites — **4 suites / 50 tests, all PASS**:

```
PASS Backend/HBOS/test/CommercialAcceptanceBarrier.test.ts
PASS Backend/HBOS/test/InstalledProductPackagingRepair.test.ts
PASS Backend/HBOS/test/PdfAcquisition.test.ts
PASS Backend/HBOS/test/OfflineSyncClient.test.ts
Test Suites: 4 passed, 4 total
Tests:       50 passed, 50 total
```

Bounded focused installed-product restart check (real installed shortcut target,
real runtime, kill → relaunch):

```
CYCLE first-launch:         childPid=6340 healthy=true healthMs=1636 exit={"code":0}
CYCLE restart-after-kill:   childPid=9556 healthy=true healthMs=2024 exit={"code":0}
FOCUSED_RESTART_RESULT=PASS
```

## 5. Full installed-product acceptance — PASS

Command: `node scripts/installed-product-acceptance.cjs` (real Inno Setup
compile, isolated silent install, real installed shortcut launch, authenticated
customer journey, restart/recovery). Exclusive exit code **0**.

Checks (16/16): `health`, `ready`, `web-shell`, `register`, `session`,
`pdf-boundary`, `ingest`, `analysis`, `dashboard`, `sources`,
`tenant-isolation`, `offline-queue`, `offline-reload`, `offline-reconnect`,
`restart-recovery`, `persistence`.

Evidence: `.kilo/evidence/stage15-k8-installed-product-acceptance.txt`
(`{ "type": "INSTALLED_PRODUCT_ACCEPTANCE", "status": "PASS" }`) and the
harness-written `.hooshyar/installed-product-acceptance.json`
(`launcherHealthy: true`, `runtimeDependenciesVerified: true`,
`repairedClientInstalled: true`, `profit: 200`, `sourceSha256: d74b461f…`).

The installed customer journey is therefore proven end-to-end:
shortcut → launcher → runtime → health → authentication → PDF capability
boundary → CSV ingest → analysis → dashboard → tenant isolation → restart →
recovery → persistence.

## 6. Related K8 evidence (not re-run — not invalidated)

- PDF acquisition acceptance: `.hooshyar/pdf-acquisition-acceptance.json` (PASS,
  2026-09-15T07:04:19Z, 6/6 checks).
- Web/application acceptance: `.hooshyar/web-acceptance-success.json` (PASS,
  v8, 2026-09-15T07:04:54Z, 35/35 acceptance keys) and
  `.kilo/evidence/stage15-k8-web-application-acceptance.txt`.

The repair is confined to the installed-product acceptance harness; it does not
touch the web client, runtime or ingestion code paths, so no web/PDF acceptance
was invalidated.

## 7. Remaining blockers / commercial state

External/approval blockers: **B1** encryption-at-rest / key management
(architecture change control, pending human 05C decisions), **B2** payment
provider activation, **B3** production cloud/DNS/TLS resources, **B4** Android
device acceptance. **B5 is CORRECTED (2026-09-16) to AVAILABLE ON THIS HOST** —
Inno Setup 6.7.3 at `C:\Users\avalipour\AppData\Local\Programs\Inno Setup 6\ISCC.exe`
(the earlier probe checked only Program Files); only *other* build hosts still need
Inno Setup 6 installed. Audit: `governed-commercialization-b1-b5-truth-2026-09-16`.

`productComplete` and `externalProductionDependenciesComplete` remain **FALSE**
(the external production dependencies still block commercial completion).

## 8. DO-NOT-REPEAT

- Do not launch the installed product through `cmd.exe /c "\"<path>\""`; use the
  real shortcut target (`wscript.exe <app>\launch-hooshyar.vbs`) with a single
  unquoted path argument.
- Do not discard the launcher's exit code/stderr or replace the real health
  check with a fixed delay.
- Do not weaken the acceptance criteria, mock the installed product, or replace
  the installed acceptance with the source-tree acceptance.
- Do not change the product launcher to compensate for a harness bug.
- Do not `git reset`/`clean`/`stash`; do not stage unrelated worktree files.

---

**Checkpoint artifact:** `.kilo/plans/stage15-k8-installed-product-acceptance-checkpoint.md`
**Evidence artifact:** `.kilo/evidence/stage15-k8-installed-product-acceptance.txt`
**Audit Memory:** Master Charter §15.1.4 / §15.1.1 baseline
`stage15-k8-installed-product-acceptance-2026-09-15`.
