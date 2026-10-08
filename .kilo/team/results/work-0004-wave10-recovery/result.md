# WORK-0004 — Wave 10 Recovery / Integration Reconciliation

WORKER_ID = work-0004-wave10-recovery
WORK_ID = WORK-0004
ROLE = Recovery Reconciliation
OWNER_ENGINE = INTEGRATOR
MODE = REVIEW
TEAM_ORGANIZATION_VERSION = V2
START_SHA = 6c9d4da5b04a1063e9fe616c2b1c4d9fd072397b
REPORT_PATH = .kilo/team/results/work-0004-wave10-recovery/result.md

# STATUS

REVIEW_COMPLETE = TRUE
WAVE_10_WORKER_EVIDENCE = VERIFIED_RECOVERABLE (11 of 12 commits, mechanically)
WAVE_10_QC = PASS (independently reproduced from run log)
WAVE_10_INTEGRATION = FAILED (0 of 12 worker commits promoted)
WAVE_10_RECOVERY = FAILED (never reached drift evaluation)
ROOT_CAUSE_OF_INTEGRATION_FAILURE = MISSING_GIT_COMMITTER_IDENTITY (not target drift)
MEMORY_CLASSIFICATION_CORRECTED = TRUE (BLOCKER-0001 and wave-history WAVE-0010)
PRODUCT_CODE_CHANGED = NONE
WORKING_TREE_BEFORE_THIS_LEASE = CLEAN

Epistemic labels used below: FACT = directly reproduced from repository or
GitHub Actions evidence in this lease; ASSUMPTION = believed, not proven;
HYPOTHESIS = falsifiable; MEASURED RESULT = executed and observed here.

# SCOPE

Leased focus: "Reconcile Wave 10 worker evidence, controlled target drift and
recovery outcome; do not repeat accepted audit work without current
regression/invalidation evidence."

Work Registry `evidence_required` for WORK-0004: `worker_envelopes`,
`qc_result`, `target_drift`, `recovery_outcome`. All four are addressed below.

WRITE_SCOPE honoured: exactly one new file under
`.kilo/team/results/work-0004-wave10-recovery/`. No memory file, workflow,
charter, architecture, manifest, test or product file was modified.

Anti-duplication gate: WORK-0004 is `READY`, not DONE/VERIFIED/ACCEPTED, so it
is not duplicate work. The eleven Wave 10 *audit reports* themselves were not
re-audited, re-generated or repeated; only their envelope, QC, drift and
recovery evidence was reconciled. EVIDENCE-0001..0004 and EVIDENCE-0005 remain
untouched.

# CURRENT_EVIDENCE

## E1 — Wave 10 run envelope (FACT)

Run `37743827267`, workflow "HooshyarOS Autonomous Team Worker", event
`issue_comment`, run headSha `629ef38f3dd259867c2167d8e21c47a0ed0c68e0`,
created 2026-10-08T07:30:15Z, updated 2026-10-08T08:19:24Z, conclusion
`failure`. Run number 10.

Job results (`gh run view 37743827267 --json jobs`):

| Job | Conclusion |
|---|---|
| prepare | success |
| team-worker × 11 | success |
| team-worker (architecture-governance) | **failure** |
| quality-control | success |
| integrate | **failure** |
| synthesize | skipped |

12 leases dispatched, 11 succeeded, 1 failed → 11/12 = 91.7% worker success.
`TARGET_BRANCH=fix/autonomous-product-factory`,
`START_SHA=04119244e326f498db21f81f0509dd8374e10cf5` were the exported
integration inputs.

## E2 — Worker envelopes and branch discipline (VERIFIED here, not recalled)

FACT: 11 remote branches `origin/opencode/team-<id>-37743827267` exist.
For every one of the 11:

- merge-base with the target branch tip = `04119244e326f498db21f81f0509dd8374e10cf5`
  (uniform across all 11) → ancestry from START_SHA holds for 11/11, matching
  Integrator step "verifies worker branch ancestry from START_SHA".
- exactly **1** commit ahead of START_SHA → "one worker one coherent commit"
  holds for 11/11.
- exactly **1** changed path, always
  `.kilo/team/results/<worker-id>/result.md` → lease write scope holds for
  11/11, and the 11 scopes are pairwise disjoint (Team Worker V1 integration
  should be mechanically conflict-free, as the protocol predicts).
- no protected path (`.github/**`, `Docs/ARCHITECTURE.md`,
  `Docs/HOOSHYAROS_MASTER_CHARTER.md`, `Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md`,
  `Assistant/SYSTEM_PROMPT.md`, `package.json`, `.env`) touched by any of the
  11 worker commits.
- `git show --check <commit>` reports **0** trailing-whitespace /
  blank-line-at-EOF errors for all 11.

`architecture-governance` has **no** branch and no commit. Its envelope was
still emitted with `status=FAILED`, `commit_sha=""` (job log, worker result
step). Its `result.md` survives only as CI artifact
`team-result-architecture-governance` (45152 bytes,
`expires_at=2027-01-06T07:30:15Z`).

## E3 — The failed worker (VERIFIED here)

FACT: the architecture-governance worker failed on a mechanical validation
gate, not on content. Its result.md line 591 carries a Markdown table row with
trailing whitespace:

```
.kilo/team/results/architecture-governance/result.md:591: trailing whitespace.
+| R3 | Stray `*.log` / `*.pem` / `*.key` / `.env.local` committed by an autonomous `git add -A` run | ... |
##[error]Process completed with exit code 2.
```

This confirms DEFECT-0001's classification (`CONTROLLED / NOT PRODUCT
DEFECT`). It is also self-referential evidence: that worker found the
protected-boundary `git add -A` hazard inside the control plane itself.

## E4 — QC result (VERIFIED here, and NOT a false green)

FACT: `quality-control` job conclusion `success`, 07:52:20Z → 08:19:14Z
(27 min). Its script ran candidate models under `timeout ... 12m` with
`QC_DECISION=PASS|FAIL` required exactly once in the final response.

Attempt timeline from the job log:
- 07:52:34 `opencode/space-bunny-free` → hit the 12-minute timeout.
- 08:04:32 `opencode/nemotron-3.5-lightning-free` → hit the 12-minute timeout.
- 08:16:32 `opencode/nemotron-3-ultra-free` → emitted `QC_DECISION=PASS` at
  08:19:12, then `TEAM_QC_STATUS=PASS`.

The verdict is substantively grounded, not a rubber stamp: immediately before
`QC_DECISION=PASS` the log shows the agent globbing
`**/result.md in .kilo/team/results · 12 matches` and reading
performance-management, process-architecture, quality-harness, reconciliation
and report-presentation `result.md`, and the stated reasons are specific
("every finding cites file:line or executed probe output", "all defer
contradictions to ACC", "explicit OVERLAPS sections").

I explicitly checked and then **rejected** a false-green hypothesis: the log
also contains `Glob ".kilo/team/results/*/result.md" 0 matches` and an
`ls .kilo/team/` listing with no `results/` directory. Those are glob
path-rooting artifacts of the agent's tooling (the same files resolve through
`in .kilo/team/results`), not an empty input set. **EVIDENCE-0001 stands as
VERIFIED.** One scope caveat: QC reviewed 12 reports, so it also reviewed
`architecture-governance/result.md` from the artifact — that content is
semantically QC-passed but was never mechanically accepted.

## E5 — Integration failure root cause (VERIFIED here; corrects memory)

The `integrate` job ran this loop (full script captured from the job log):

```
mapfile -t RESULTS < <(find "${RUNNER_TEMP}/team-results" -name result.json | sort)
for file in "${RESULTS[@]}"; do
  test "${START}" = "${START_SHA}" || exit 31
  if test "${STATUS}" != "SUCCESS"; then echo "ISOLATED_FAILURE=${WORKER_ID}"; continue; fi
  git fetch origin "${BRANCH}"
  git merge-base --is-ancestor "${START_SHA}" "${COMMIT}"
  git merge-base --is-ancestor "${COMMIT}" "origin/${BRANCH}"
  # write-scope coverage check over git diff --name-only START_SHA...origin/BRANCH
  git cherry-pick "${COMMIT}"
done
test "${SUCCESS_COUNT}" -gt 0
git diff --check
```

Actual terminal output:

```
ISOLATED_FAILURE=architecture-governance
From https://github.com/hooshyarAI/HooshyarOS
 * branch  opencode/team-benchmark-123-37743827267 -> FETCH_HEAD
Committer identity unknown
*** Please tell me who you are.
fatal: empty ident name (for <runner@runnervmmprz5...>) not allowed
##[error]Process completed with exit code 128.
```

FACT: the job aborted at the **first** processed envelope (`benchmark-123`,
first in sorted order) inside `git cherry-pick`, exit code **128**, because the
runner had no git committer identity. Therefore:

- 0 of 11 successful worker commits were integrated. `SUCCESS_COUNT` never
  incremented, so `test "${SUCCESS_COUNT}" -gt 0` would have failed even with
  an identity present.
- The "Reconcile target before promotion" drift gate
  (`test "${CURRENT_TARGET_SHA}" = "${START_SHA}" || exit 32`) exists at line
  875 of the workflow **at the Wave 10 headSha**, but it runs *after* the
  cherry-pick loop. It was structurally unreachable.
- Root cause is a control-plane defect, not target drift.

## E6 — Recovery outcome (VERIFIED here)

Recovery run `37749071519`, workflow "HooshyarOS Team Wave Recovery Integrator",
headSha `9a1f10a5`, created 2026-10-08T08:19:26Z. Jobs:
`recover-controlled-drift` = **failure**, `recover-synthesize` = **skipped**.

The recovery step passed its eligibility checks, then died on a shell-scope
defect:

```
RECOVERY_START_SHA=04119244e326f498db21f81f0509dd8374e10cf5
RECOVERY_ENVELOPES=12
.../519276c3-....sh: line 51: RECOVERY_START_SHA: unbound variable
##[error]Process completed with exit code 1.
```

Cause: the script writes `recovery.env` and appends it to `$GITHUB_ENV`, then
uses `${RECOVERY_START_SHA}` in the **same** `set -euo pipefail` step. Values
written to `$GITHUB_ENV` only reach *later* steps, so under `-u` the drift
command aborted. The controlled-drift gate therefore **never evaluated
drift**, and no worker branch was ever imported by the recovery path.

## E7 — Target drift, measured (MEASURED RESULT here)

Drift is real and cumulative, measured as
`git diff --name-only 04119244...6c9d4da5` = **20 paths** (39 commits),
including 2 protected-path control-plane files:

```
.github/workflows/final-product-factory-trigger.yml
.github/workflows/final-product-factory.yml
.kilo/plans/ACTIVE-AUTONOMOUS-INTELLIGENCE-QUALITY-PRODUCT-EVOLUTION-MISSION.md
.kilo/team/COMMANDS/POST-TEAM-V2-PERFORMANCE-AUDIT-EDIT-REPAIR.md
.kilo/team/NEXT-WAVE-PLAN.json
.kilo/team/TEAM-ORGANIZATION-V2-PROTOCOL.md
.kilo/team/TEAM-ORGANIZATION-V2.json
.kilo/team/TEAM-WORKER-V1-PROTOCOL.md
.kilo/team/TEAM-WORKER-V1.json
.kilo/team/memory/README.md
.kilo/team/memory/blocker-registry.json
.kilo/team/memory/commit-registry.json
.kilo/team/memory/decision-registry.json
.kilo/team/memory/defect-registry.json
.kilo/team/memory/evidence-registry.json
.kilo/team/memory/mission-state.json
.kilo/team/memory/wave-history.json
.kilo/team/memory/work-registry.json
.kilo/team/results/work-0006-team-performance-evaluation/PRE-GATE-BASELINE.md
Docs/HOOSHYAROS_MASTER_CHARTER.md
```

The recovery gate's `SAFE` allowlist is a static 2-file list
(`.kilo/team/TEAM-WORKER-V1-PROTOCOL.md`, `Docs/HOOSHYAROS_MASTER_CHARTER.md`).
Only 2 of the 20 drift paths are on it, so the gate would `exit 42` even if
E6 were fixed. That drift is already merged and can never shrink.

Note the drift is *inert* for the Wave 10 payloads: none of the 20 drift paths
lies under any Wave 10 worker write scope, and no drift path collides with
`.kilo/team/results/<worker-id>/`.

## E8 — Recoverability, measured (MEASURED RESULT here)

I created a detached scratch worktree at `6c9d4da5` and cherry-picked all 11
Wave 10 worker commits in sorted branch order:

- `CHERRY_PICK_OK` × **11**, `CHERRY_PICK_FAIL` × **0**.
- After integration, `git diff --check 04119244 HEAD` reported whitespace
  errors **only** in pre-existing drift files, and **none** in any
  `.kilo/team/results/*/result.md`.
- The scratch worktree was removed and pruned; this repository's working tree
  and `HEAD` are unchanged.

Therefore: FACT — the eleven Wave 10 audit reports are mechanically
recoverable onto the current target tip with zero conflicts. The blocker is
the recovery *gate*, not the content.

# FINDINGS

## F-1 (P0, CORRECTION) — BLOCKER-0001's title is misattributed

`blocker-registry.json` BLOCKER-0001 is titled "Wave 10 integration target
drift" with `severity P0` and a safe-unblock that presumes drift was observed.
Reproduction (E5, E6) shows:

- drift was never the cause of the integrate failure (exit 128, git identity);
- drift was never evaluated by recovery (`unbound variable`, E6);
- a 2-file allowlist vs 20 real drift paths would block recovery anyway (E7).

Classification must become: `MISSING_GIT_COMMITTER_IDENTITY_IN_INTEGRATE_JOB`,
with the drift-gate misdesign as a distinct, independent P0/P1 finding (F-4).
This memory correction belongs to WORK-0003 (owner of `.kilo/team/memory/**`)
or MEMORY_EDITOR; WORK-0004 is REVIEW-only and must not edit memory.

## F-2 (P0, LIVE DEFECT) — the Wave 10 root cause is still unrepaired

FACT: `git grep` for `user.email`, `user.name` and `git config` in
`.github/workflows/hooshyaros-team-worker.yml` at `origin/main`
(`fdd289c2`) returns **zero** matches, while the `integrate` job still runs
`git cherry-pick "${COMMIT}"` (line 1095) under `set -euo pipefail`.

HYPOTHESIS (H-1, falsifiable, not yet measured end-to-end): the next wave that
reaches integration will fail at the first cherry-pick with exit 128 exactly as
Wave 10 did. Falsifier: a future run whose `integrate` job logs
`INTEGRATED=<worker> <sha>` without any git-identity step. I did not dispatch a
wave to test this; it is out of this lease's scope and protected-path
boundary.

## F-3 (P1, LIVE DEFECT) — recovery gate shell-scope defect is still unrepaired

FACT: `.github/workflows/hooshyaros-team-wave-recovery.yml` at `origin/main`
still contains the identical bug — writes `recovery.env` → `cat recovery.env
>> "$GITHUB_ENV"` (line 88) → uses `"${RECOVERY_START_SHA}"` in the same
`set -euo pipefail` step (line 90). Downstream steps (lines 125, 133, 150) do
receive the variable and are correct. So the only broken consumer is the drift
gate itself, which is precisely the safety check recovery exists to perform.
19 subsequent recovery runs (09:48Z → 12:22Z on 2026-10-08) all report
`skipped`, so this path has produced zero verified recoveries to date.

## F-4 (P1, DESIGN) — the drift gate is mis-scoped, blocking legitimate recoveries

The gate compares the *entire* cumulative drift since the worker's START_SHA
against a 2-file allowlist. Real integration risk is the intersection of drift
with (a) any worker write scope and (b) protected paths — which is provably
empty here (E7, E8). As written, the gate can never pass for any wave whose
target branch advanced during the wave, i.e. it rejects exactly the situation
it was built for. It is a fail-closed gate with no bounded path to PASS.

## F-5 (P1, DESIGN) — no atomic rollback; partial integration is possible

`set -euo pipefail` + in-loop `git cherry-pick` means a mid-loop failure
leaves earlier cherry-picks already applied and `CHERRY_PICK_HEAD` set, with no
`git cherry-pick --abort` / reset and no per-worker isolation. The
`test "${SUCCESS_COUNT}" -gt 0` gate then reports "0 integrated" while the
worktree actually contains earlier commits — a partial-integration state that
no later step distinguishes from a clean one. Wave 10 escaped this only because
it failed on the very first cherry-pick.

## F-6 (P2, LATENT FALSE-GREEN) — QC gate accumulates state across model attempts

The QC loop appends every attempt to one `$LOG` and then tests
`grep -q QC_DECISION=PASS "$LOG" && ! grep -q QC_DECISION=FAIL "$LOG"`. Once any
attempt emits PASS, the gate is satisfied for that and any later attempt even if
a subsequent attempt emits FAIL (the FAIL cannot win because the early PASS is
still in the log). Wave 10 was unaffected — no attempt emitted FAIL, and PASS
came from the last attempt — but this ordering is unsafe in general and should
be per-attempt.

## F-7 (P2, TRACEABILITY) — QC verdict has no durable artifact

FACT: the run produced 12 `team-result-*` artifacts and no QC artifact. The QC
verdict is only recoverable from the job log. `evidence-registry.json`
EVIDENCE-0001 therefore cites a *run id*, not a persisted report. It remains
verifiable today, but it is one log-retention window from being unverifiable.

## F-8 (P2, CURRENT REGRESSION OF DEFECT-0001's CLASS) — the drift itself is not diff-gate clean

MEASURED: `git diff --check 04119244 6c9d4da5` fails on 5 drift files —
`.kilo/team/COMMANDS/POST-TEAM-V2-PERFORMANCE-AUDIT-EDIT-REPAIR.md` (23),
`.kilo/team/TEAM-ORGANIZATION-V2-PROTOCOL.md` (3),
`.kilo/team/memory/README.md` (3), `.kilo/team/TEAM-WORKER-V1-PROTOCOL.md`
(blank line at EOF), `Docs/HOOSHYAROS_MASTER_CHARTER.md` (blank line at EOF).
Attributed commits: `bbff9dfc` (23), `7f808ce1` (3), `99779692` (3),
`cf8c8ef3` (1). This is the same trailing-whitespace class as DEFECT-0001, now
inside the governance/memory layer the team itself owns — introduced by
control-plane commits after Wave 10, not by Wave 10 workers. It does not block
a fresh integrate (the diff gate runs on the checkout tree, which is clean at
START_SHA), but it means the team diff gate is currently unenforceable as a
repo-wide invariant.

## F-9 (P3, OBSERVATION) — QC latency is dominated by model timeouts

2 of 3 QC attempts consumed the full 12-minute timeout (24 of 27 minutes).
Measured QC latency cost ≈ 22 minutes for one PASS. Worker failure isolation
and independent QC both demonstrably work; only the model-fallback path is
slow. This is a throughput fact for WORK-0006, not a correctness defect.

## F-10 (FACT, NO CHANGE) — architecture-governance evidence has one carrier only

Its `result.md` exists only as CI artifact until 2027-01-06. There is no
branch and no commit, so no governed recovery path can ever import it. If that
audit's findings matter to WORK-0007, they must be re-derived from the artifact
under a new lease rather than assumed recoverable. I did not read or restate
its content, to avoid duplicating accepted audit work.

# DEPENDENCIES

- WORK-0001 (ACTIVE, MISSION_DIRECTOR) — the parent reconciliation this
  depends on. Not required to be complete for these findings to hold; every
  claim here is anchored to immutable run/branch evidence.
- WORK-0003 (READY, PLANNER, owns `.kilo/team/memory/**`) — **must consume
  F-1**. BLOCKER-0001 and `wave-history.json` WAVE-0010
  (`integration: FAIL_DUE_CONTROLLED_TARGET_DRIFT`) currently encode a cause
  that this review disproves. Correcting them is memory-editor work, not
  integrator work, and is outside my WRITE_SCOPE.
- WORK-0006 (PLANNED, gate) — **its pre-gate baseline contains two claims this
  review contradicts.** `PRE-GATE-BASELINE.md` states "Original Integrator job:
  FAIL due controlled target drift" (F-1) and "Recovery Capability: controlled
  recovery path executed/preserved evidence" (E6: recovery executed only its
  eligibility parse). Final Gate A must consume this correction or it will
  adjudicate on a wrong baseline.
- BLOCKER-0002 (GitHub Actions runner queue) — orthogonal; it affects WAVE-0011
  dispatch, not the Wave 10 evidence conclusions. No inference drawn from
  queued state, per its own rule.
- COMMIT-0004 (`3535384c`, "controlled target-drift recovery") was authored at
  2026-10-08 08:18Z, ~60s before the failing integrate job started, but the job
  executed the workflow from run headSha `629ef38f`. The repair landed too late
  and, per F-2/F-3, incompletely.
- Current-wave facts: my worker branch tip `6c9d4da5` still equals
  `origin/fix/autonomous-product-factory`, so the promote-time drift gate would
  pass if it were ever reached. `origin/main` is `fdd289c2` and is neither an
  ancestor nor a descendant of this branch; I did not touch it.

# RISKS

- R-1 (HIGH) — Any new wave will repeat the Wave 10 integration failure (F-2).
  Bounded impact: wave evidence stays stranded on worker branches, exactly as
  Wave 10's is. No corruption, no product damage.
- R-2 (HIGH) — Wave 10 evidence can never be recovered through the governed
  recovery path as written (F-3 + F-4). The 11 reports are demonstrably
  recoverable by cherry-pick but the gate can never pass. If the team keeps
  recording "recovery attempted", it will keep accruing unrecoverable accepted
  work.
- R-3 (MEDIUM) — Partial integration is unrepresentable (F-5). A future
  mid-loop failure produces a worktree whose actual content contradicts
  `SUCCESS_COUNT=0`, and the push step is downstream of the failing step, so it
  currently fails safe. It becomes dangerous the moment anyone adds a
  best-effort push.
- R-4 (MEDIUM) — QC can be satisfied by a stale early PASS (F-6). Not triggered
  in Wave 10; becomes live whenever a fallback model chain is used.
- R-5 (MEDIUM) — `architecture-governance`'s findings rest on a single expiring
  artifact (F-10). After 2027-01-06 they are unrecoverable.
- R-6 (LOW) — The governance/memory layer is not diff-gate clean (F-8). Any
  future tightening of the diff gate to repo scope will block on files unrelated
  to the change under test.
- R-7 (PROCESS) — Accepting a misclassified blocker propagates into WORK-0006
  performance adjudication. This is the highest-leverage near-term risk,
  because the wrong baseline is currently the gate's input.

# OVERLAPS

- WORK-0003 — F-1 correction must be applied there, not here. Explicitly
  recorded rather than duplicated; I made no memory edit.
- WORK-0005 — not touched. Selecting the next genuinely missing capability is a
  PLANNER lease and depends on WORK-0003; F-2/F-3 are control-plane
  (non-product) findings and must not be presented as product gaps.
- WORK-0006 — the pre-gate baseline overlaps E5/E6. Recorded as a dependency
  conflict, not rewritten.
- EVIDENCE-0001 (QC) and DEFECT-0001 (whitespace) — re-verified, and both
  **stand**. No invalidation evidence found. DEFECT-0001's "evidence report
  itself was preserved" is precise only if read as "preserved as a CI
  artifact"; see F-10.
- The eleven Wave 10 audit reports — deliberately not re-read or re-judged.
  This lease reconciled their envelopes, not their content.
- No other lease's write scope overlaps
  `.kilo/team/results/work-0004-wave10-recovery/`.

# RECOMMENDED_NEXT_MICRO_STAGE

One Micro-Stage, one owner, one coherent commit, IMPLEMENT mode, on a
**protected-path control-plane lease** (this lease may not do it; see risks).

**Title:** Control-plane repair of the Wave 10 integration and recovery gates.

**Owner:** ORCHESTRATOR / control plane (not INTEGRATOR-as-worker, because
`.github/workflows/**` is in `TEAM-WORKER-V1.json` protected_paths).

**Scope, bounded to four defects:**
1. In `hooshyaros-team-worker.yml` `integrate`: set an explicit repository-local
   git committer identity before the cherry-pick loop (F-2).
2. In the same job: make the loop atomic — `git cherry-pick --abort` plus a
   reset to START_SHA on any failure, and report per-worker `INTEGRATED` counts
   that match reality (F-5).
3. In `hooshyaros-team-wave-recovery.yml`: `source`/`eval` the generated env in
   the step that needs it, or split the drift gate into its own step (F-3).
4. Replace the 2-file `SAFE` allowlist with an intersection test: fail only when a
   drift path is inside any worker write scope or inside a protected path
   (F-4). This keeps fail-closed semantics for the real risk while making a
   clean recovery reachable.

**Verification contract:** for each of 1–4, a focused assertion on the changed
script plus one dry-run integration/recovery rehearsal that demonstrates
(a) a git-identity-less runner no longer aborts integration, and (b) the
Wave 10 envelope set passes the repaired drift gate while a deliberately
protected-path-touching envelope is still rejected. Must not be asserted from
model output.

**Explicitly out of scope:** re-auditing the eleven reports, F-8 whitespace
cleanup of governance files (separate lease), product code, Architecture Freeze
V4/V4.1, governance charters, memory ledgers.

**Sequencing:** do this *before* WAVE-0011 integration is expected to succeed,
and route F-1 to WORK-0003 in the same wave so WORK-0006's Gate A is not
adjudicated on the corrected-but-unrecorded baseline. If the control-plane
lease cannot be granted, the honest fallback is `BLOCKED_CONTROL_PLANE` with
this report as the evidence — not another wave that will strand its evidence
the same way.

# VERIFICATION_METHOD

All conclusions are reproducible from immutable evidence with the commands
below. No conclusion rests on model self-report.

| Claim | Method | Result |
|---|---|---|
| 12 leases / 11 success / 1 failure | `gh run view 37743827267 --json jobs` | reproduced |
| integrate exit 128, git identity | integrate job log, terminal lines | reproduced |
| recovery unbound variable | run `37749071519` job log, line 51 | reproduced |
| QC PASS by 3rd candidate | run `37743827267` QC job log | reproduced |
| uniform START_SHA ancestry, 1 commit, 1 in-scope path, 0 protected paths | `git for-each-ref` + `git merge-base` + `git diff --name-only` per branch | reproduced, 11/11 |
| worker commits whitespace-clean | `git show --check <sha>` per branch | 0 errors, 11/11 |
| drift = 20 paths | `git diff --name-only 04119244...6c9d4da5` | reproduced |
| recovery allowlist = 2 paths | recovery job log `SAFE=` block | reproduced |
| Wave 10 cherry-pickable onto current tip | detached scratch worktree at `6c9d4da5`, 11 cherry-picks, then removed and pruned | 11 ok / 0 fail |
| identity defect still live | `git show origin/main:.github/workflows/hooshyaros-team-worker.yml` \| grep identity | 0 matches |
| recovery scope defect still live | `git show origin/main:.github/workflows/hooshyaros-team-wave-recovery.yml` lines 84-90 | reproduced |

Proportionality: this is a REVIEW lease over immutable historical evidence, so
verification is read-only reproduction plus one isolated dry-run rehearsal. No
product test suite was executed because no product code changed. The scratch
worktree was deleted and pruned; `git status` is clean and `HEAD` is unchanged
at `6c9d4da5`.

# PROVENANCE

- START_SHA (given): `6c9d4da5b04a1063e9fe616c2b1c4d9fd072397b`
- HEAD at report time: `6c9d4da5b04a1063e9fe616c2b1c4d9fd072397b`
- Branch: `opencode/team-work-0004-wave10-recovery-37776552275`
- Wave 10 run: `37743827267`, headSha `629ef38f3dd259867c2167d8e21c47a0ed0c68e0`,
  Wave 10 `START_SHA` `04119244e326f498db21f81f0509dd8374e10cf5`,
  `TARGET_BRANCH` `fix/autonomous-product-factory`
- Wave 10 recovery run: `37749071519`, headSha `9a1f10a5`
- Wave 10 worker branches reconciled (all `origin/opencode/team-*-37743827267`):
  `9f22218e` reconciliation, `654d17ab` intelligence-brain,
  `7010e238` benchmark-123, `50dc9967` quality-harness,
  `cf797986` information-flow, `5d2baf0a` performance-management,
  `d173e70f` process-architecture, `e226ad2d` report-presentation,
  `8fd23279` chart-gate, `f14bcdeb` open-source-leverage,
  `1f9d025a` commercial-acceptance
- Wave 10 artifact set: 12 × `team-result-*` from run `37743827267`,
  `expires_at 2027-01-06T07:30:15Z`
- Control-plane refs read (read-only): `origin/main` = `fdd289c2`;
  `origin/fix/autonomous-product-factory` = `6c9d4da5`
- Read memory inputs: `mission-state.json`, `work-registry.json`,
  `evidence-registry.json`, `decision-registry.json`, `defect-registry.json`,
  `blocker-registry.json`, `commit-registry.json`, `wave-history.json`,
  `README.md`
- Read authority inputs: `AGENTS.md`, `TEAM-WORKER-V1.json`,
  `TEAM-WORKER-V1-PROTOCOL.md`, `TEAM-ORGANIZATION-V2.json`,
  `TEAM-ORGANIZATION-V2-PROTOCOL.md`, `NEXT-WAVE-PLAN.json`,
  `NEXT-WAVE-PLAN.schema.json`,
  `ACTIVE-AUTONOMOUS-INTELLIGENCE-QUALITY-PRODUCT-EVOLUTION-MISSION.md`,
  `PRE-GATE-BASELINE.md`
- Not read, deliberately: the eleven Wave 10 `result.md` bodies, to avoid
  duplicating accepted audit work. Only envelope-level facts were used.
- Scratch artifacts (outside the repository): `/tmp/opencode/*.log`,
  `/tmp/opencode/recovery-current.yml`, `/tmp/opencode/tw-current.yml`,
  `/tmp/opencode/tw-w10.yml`. Worktree `/tmp/opencode/cp` removed and pruned.
- Secrets, personal data and customer financial data: none accessed,
  transmitted or written. `gh` was used read-only for run/job/log/artifact
  inspection; no workflow, manifest, secret, deployment setting or protected
  path was modified. No force-push, no reset, no history rewrite, no test
  weakened or deleted.