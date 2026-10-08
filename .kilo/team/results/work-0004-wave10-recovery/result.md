# WORK-0004 — Wave 10 Recovery / Integration Reconciliation

WORKER_ID = work-0004-wave10-recovery
WORK_ID = WORK-0004
ROLE = Recovery Reconciliation
OWNER_ENGINE = INTEGRATOR
MODE = REVIEW
TEAM_ORGANIZATION_VERSION = V2
START_SHA = 6c9d4da5b04a1063e9fe616c2b1c4d9fd072397b
REPORT_PATH = .kilo/team/results/work-0004-wave10-recovery/result.md
RUN_ID = 37779956878

Epistemic labels: FACT = reproduced from immutable repository or GitHub Actions
evidence in this lease; MEASURED RESULT = executed and observed here;
ASSUMPTION = believed, unproven; HYPOTHESIS = falsifiable, unconfirmed.

# STATUS

WAVE_10_WORKER_ENVELOPES = VERIFIED (11 of 12; reproduced independently)
WAVE_10_QC = PASS (EVIDENCE-0001 upheld)
WAVE_10_INTEGRATION = FAILED
ROOT_CAUSE_OF_INTEGRATION_FAILURE = MISSING_GIT_COMMITTER_IDENTITY (not target drift)
WAVE_10_RECOVERY = FAILED_BEFORE_DRIFT_EVALUATION (never imported any worker)
WAVE_10_EVIDENCE_RECOVERABLE = YES (measured, 11/11 cherry-pick clean)
MEMORY_CORRECTIONS_REQUIRED = BLOCKER-0001, BLOCKER-0002, WAVE-0010 record (owned by WORK-0003)
PRIOR_ATTEMPT_SUPERSEDED = ba49094f (orphan branch, same START_SHA, never integrated)
PRODUCT_CODE_CHANGED = NONE
WORKING_TREE_BEFORE_THIS_LEASE = CLEAN

# SCOPE

Leased focus: "Reconcile Wave 10 worker evidence, controlled target drift and
recovery outcome; do not repeat accepted audit work without current
regression/invalidation evidence."

Work Registry `evidence_required` for WORK-0004 — `worker_envelopes`,
`qc_result`, `target_drift`, `recovery_outcome` — all four are answered below.

WRITE_SCOPE honoured: exactly one new file under
`.kilo/team/results/work-0004-wave10-recovery/`. No memory file, workflow,
charter, architecture document, manifest, test or product file was modified.

Anti-duplication gate: WORK-0004 is `READY` in `work-registry.json`, not
DONE/VERIFIED/ACCEPTED/SUPERSEDED, so this lease is not a repeat of accepted
work. A prior WORK-0004 attempt (`ba49094f`) exists but is stranded on an
orphan branch outside this lineage; I treated it as evidence to be
independently re-verified, not as a result to be trusted or silently
duplicated. The eleven Wave 10 *audit reports* were deliberately not read,
re-audited or re-judged — only their envelope, QC, drift and recovery
evidence was reconciled. EVIDENCE-0001..0005 were left untouched.

# CURRENT_EVIDENCE

## E1 — Wave 10 run envelope (FACT, reproduced)

Run `37743827267`, workflow "HooshyarOS Autonomous Team Worker", event
`issue_comment`, headSha `629ef38f3dd259867c2167d8e21c47a0ed0c68e0`,
created `2026-10-08T07:30:15Z`, updated `08:19:24Z`, conclusion `failure`.
Exported integration inputs: `TARGET_BRANCH=fix/autonomous-product-factory`,
`START_SHA=04119244e326f498db21f81f0509dd8374e10cf5`.

| Job | Conclusion | Window |
|---|---|---|
| prepare | success | 07:30:18 → 07:30:23 |
| team-worker × 11 | success | 07:30:26 → 07:52:17 |
| team-worker (architecture-governance) | **failure** | 07:30:27 → 07:43:00 |
| quality-control | success | 07:52:20 → 08:19:14 |
| integrate | **failure** | 08:19:17 → 08:19:23 |
| synthesize | skipped | — |

12 leases dispatched, 11 succeeded, 1 failed → 11/12 = 91.7% worker success.

## E2 — Worker envelopes verified mechanically (MEASURED RESULT here)

FACT: 11 remote branches `origin/opencode/team-<id>-37743827267` exist. For
every one of the 11, measured independently:

- `git merge-base <branch> 04119244` = `04119244…` → ancestry from START_SHA
  holds **11/11**.
- exactly **1** commit ahead of START_SHA → one worker, one coherent commit
  holds **11/11**.
- exactly **1** changed path, always `.kilo/team/results/<worker-id>/result.md`
  → lease write scope holds **11/11**, and the 11 scopes are pairwise disjoint.
- **0** changes under any `TEAM-WORKER-V1.json` protected path
  (`.github/**`, `Docs/ARCHITECTURE.md`, `Docs/HOOSHYAROS_MASTER_CHARTER.md`,
  `Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md`, `Assistant/SYSTEM_PROMPT.md`,
  `package.json`, `.env*`) → **11/11 clean**.
- **0** whitespace errors from `git show --check` (counting only
  `trailing whitespace` / `blank line at EOF`) → **11/11 clean**.

Branches reconciled: `benchmark-123` `7010e238`, `chart-gate` `8fd23279`,
`commercial-acceptance` `1f9d025a`, `information-flow` `cf797986`,
`intelligence-brain` `654d17ab`, `open-source-leverage` `f14bcdeb`,
`performance-management` `5d2baf0a`, `process-architecture` `d173e70f`,
`quality-harness` `50dc9967`, `reconciliation` `9f22218e`,
`report-presentation` `e226ad2d`.

`architecture-governance` has **no** branch and **no** commit. Its envelope was
still emitted with `status=FAILED` and an empty `commit_sha`.

## E3 — The failed worker (FACT)

The architecture-governance worker failed on a mechanical validation gate, not
on content: its `result.md` line 591 carries a Markdown table row with
trailing whitespace, and the job exited with
`Process completed with exit code 2` from the `git diff --check` gate. This
confirms DEFECT-0001's classification (`CONTROLLED / NOT PRODUCT DEFECT`).

## E4 — QC result upheld (FACT)

`quality-control` job conclusion `success`, 07:52:20Z → 08:19:14Z
(26m 54s). MEASURED RESULT: the verdict came from the third candidate model
after two attempts consumed the full timeout budget, so QC latency was
dominated by model timeouts rather than by the checks themselves.

I actively tested and then **rejected** a false-green hypothesis: the QC log
contains both a successful glob of the team result set and a
zero-match listing of the same directory. Those are path-rooting artifacts of
the agent's own tooling, not evidence of an empty input set — the substantive
reasons recorded in the log cite specific files. **EVIDENCE-0001 stands as
VERIFIED; no invalidation evidence exists.**

Scope caveat preserved from the reconciliation: QC reviewed 12 reports,
therefore it also semantically reviewed `architecture-governance/result.md`
from its artifact. That content is QC-passed but was never mechanically
accepted, so it has no committed carrier.

## E5 — Integration failure root cause (FACT; contradicts recorded memory)

The `integrate` job's terminal log is unambiguous:

```
ISOLATED_FAILURE=architecture-governance
 * branch  opencode/team-benchmark-123-37743827267 -> FETCH_HEAD
Committer identity unknown
*** Please tell me who you are.
fatal: empty ident name (for <runner@runnervmmprz5…>) not allowed
##[error]Process completed with exit code 128.
```

FACT: the job aborted inside `git cherry-pick` on the **first** processed
envelope (`benchmark-123`, first in sorted order) with exit code 128, because
the runner had no git committer identity. Therefore:

- 0 of 11 successful worker commits were integrated.
- `SUCCESS_COUNT` never incremented, so the subsequent
  `test "${SUCCESS_COUNT}" -gt 0` would have failed even with an identity
  present.
- The "Reconcile target before promotion" drift gate exists but is a
  **separate later step** (verified at `origin/main`: step at line 1104,
  after the cherry-pick loop at line 1095). It was structurally unreachable.

Root cause is a control-plane defect. **It is not target drift.** Recorded
memory currently asserts the opposite (F-1).

## E6 — Recovery outcome (FACT)

Recovery run `37749071519`, "HooshyarOS Team Wave Recovery Integrator",
headSha `9a1f10a5`, created `2026-10-08T08:19:26Z`.
`recover-controlled-drift` = **failure**; `recover-synthesize` = **skipped**.

The step emitted `RECOVERY_START_SHA=04119244e326f498db21f81f0509dd8374e10cf5`
and `RECOVERY_ENVELOPES=12`, then died:

```
.../519276c3-….sh: line 51: RECOVERY_START_SHA: unbound variable
##[error]Process completed with exit code 1.
```

FACT: the script writes `recovery.env` and appends it to `$GITHUB_ENV`, then
reads `${RECOVERY_START_SHA}` in the **same** `set -euo pipefail` step. Values
written to `$GITHUB_ENV` only reach *later* steps, so under `-u` the drift
command aborted. The controlled-drift gate therefore **never evaluated drift**,
and no worker branch was ever imported by the recovery path.

Recorded memory says `recovery: EVIDENCE_PRESERVING_RECOVERY_ATTEMPTED`. That
is accurate only if read as "eligibility was parsed". No recovery has ever
succeeded.

## E7 — Target drift, measured (MEASURED RESULT here)

Drift is real and cumulative: `git diff --name-only 04119244...6c9d4da5` =
**20 paths** across **39 commits**, including two protected-path
control-plane files (`.github/workflows/final-product-factory.yml`,
`.github/workflows/final-product-factory-trigger.yml`) and the whole
`.kilo/team/memory/**` ledger set.

The recovery gate's `SAFE` allowlist is a static 2-file list
(`.kilo/team/TEAM-WORKER-V1-PROTOCOL.md`, `Docs/HOOSHYAROS_MASTER_CHARTER.md`).
MEASURED RESULT: replaying that gate against real drift yields
**allowed = 2, blocked = 18 → exit 42**. So even with E6 fixed, recovery would
still refuse this wave. That drift is already merged and can never shrink.

MEASURED RESULT: the intersection of the 20 drift paths with the union of all
Wave 10 worker write scopes is **empty**, and no drift path collides with
`.kilo/team/results/<worker-id>/`. The drift is therefore **inert** for the
Wave 10 payloads — real integration risk is provably zero while the gate
nonetheless blocks.

## E8 — Recoverability, measured (MEASURED RESULT here)

I created a detached scratch worktree **outside the repository** at `6c9d4da5`
and cherry-picked all 11 Wave 10 worker commits in sorted branch order:

- `CHERRY_PICK_OK` × **11**, `CHERRY_PICK_FAIL` × **0**.
- 11 `.kilo/team/results/*/result.md` files present afterwards.
- `git diff --check` over the integrated result paths reported **0** errors.
- The scratch worktree was removed and pruned; this repository's `HEAD` is
  unchanged at `6c9d4da5`, `git status` is clean, and **no** rehearsal ref was
  created.

FACT: the eleven Wave 10 audit reports are mechanically recoverable onto the
current target tip with zero conflicts. The blocker is the recovery *gate*,
not the content.

## E9 — Live defects re-verified at the CURRENT `origin/main` (MEASURED RESULT here)

`origin/main` has moved since the prior attempt read it:
`fdd289c2` → `0bfe3eae` (one commit, `0bfe3eae control(team): add workflow-level
stop escalation alert`), which adds only
`.github/workflows/team-stop-alert.yml` and does **not** touch the team
workflows. Both defects therefore remain live at the current tip:

- `.github/workflows/hooshyaros-team-worker.yml`: **0** matches for
  `user.email`, `user.name` or `git config`, while `git cherry-pick` remains at
  line 1095. The loop still contains no `git cherry-pick --abort` and no reset,
  and no per-worker isolation.
- `.github/workflows/hooshyaros-team-wave-recovery.yml`: line 88
  `cat recovery.env >> "${GITHUB_ENV}"` still precedes line 90's use of
  `${RECOVERY_START_SHA}` in the same `set -euo pipefail` step.

HYPOTHESIS H-1 (still unconfirmed): the next wave that reaches integration will
fail at the first cherry-pick exactly as Wave 10 did. Falsifier: a future
`integrate` job log showing `INTEGRATED=<worker> <sha>` with no git-identity
step. It remains unexercised because **no team-worker run since Wave 10 has
reached integration** (E12).

## E10 — A same-class defect was found, then repaired (MEASURED RESULT here)

FACT: run `37776086347` (headSha `c45ca6d5`) re-dispatched this same WORK-0004
lease and its worker job **failed** at 12:22:26Z with
`SYNTH_MODEL_CANDIDATES: unbound variable` / exit code 1, and
`STATUS="FAILED"`. Root cause is identical in shape to E6: at `c45ca6d5`,
line 700 of the **team-worker** job consumed `${SYNTH_MODEL_CANDIDATES}`, a
variable that is only produced in the later `synthesize` job.

FACT: commit `fdd289c2 fix(team): align worker model candidate contract`
repaired exactly this — line 700 now reads `${MODEL_CANDIDATES}`. Verified by
diffing the workflow across `c45ca6d5..fdd289c2`.

This is positive evidence that the control plane does repair defects when
reproduced with file:line precision, and it shows the `$GITHUB_ENV` /
same-step-consumption bug class is systemic across at least two workflows, not
unique to recovery.

## E11 — This lease's own dispatch history (MEASURED RESULT here)

WORK-0004 has been dispatched three times, which is itself the clearest
available evidence of the recovery problem:

| Run | Created | Head | Outcome |
|---|---|---|---|
| `37776086347` | 12:19:48Z | `c45ca6d5` | worker **failed** — `SYNTH_MODEL_CANDIDATES` unbound (E10); no report produced |
| `37776552275` | 12:23:48Z | `fdd289c2` | worker **success** 12:26:02 → 12:31:11Z, committed `ba49094f`; then the run was **cancelled** at 12:38:51Z with QC/integrate/synthesize cancelled and `integrate` never run |
| `37779956878` | 12:51:59Z | `fdd289c2` | this run — in progress |

FACT: run `37776552275` produced committed evidence for **two** leases —
`ba49094f` (work-0004) and `509ce84c` (work-0003) — and `509ce84c` is **not an
ancestor** of this lease's `START_SHA`, nor is `ba49094f`. Both are orphan
branches. `work-0005` was cancelled mid-run and left no branch at all.

So WORK-0004 evidence already existed, was substantively complete, and was
nonetheless stranded. That is the concrete, current instance of the recovery
failure this lease was chartered to reconcile.

## E12 — Neither recorded blocker survives current evidence (MEASURED RESULT here)

- BLOCKER-0002 ("runner queue blocks WAVE-0011", evidence
  `team_status: queued`, `runner_allocated: false`, `observed_at 2026-10-08`)
  is **stale**. Both runs it cites are `completed/cancelled`
  (`37760777088` created `2026-10-08T10:02:10Z` on headSha `9151fe4d`;
  `37759400053` created `2026-10-08T09:50:14Z` on headSha `82d63f95`), and the
  queue has since cleared — a full batch of repository workflows started at
  12:53:02–12:53:04Z and reached terminal conclusions. No inference about
  product work is drawn from those mixed conclusions; the point is only that
  the queue premise no longer holds.
- `mission-state.json` `current_run_id = 37760777088` contradicts
  `wave-history.json` `current.run_id = 37759400053`. Both are cancelled, and
  neither is the live run `37779956878`. The two ledgers disagree about which
  run is current, and both name a run that no longer exists in a running state.

## E13 — Drift is not diff-gate clean in the governance layer (MEASURED RESULT here)

`git diff --check 04119244 6c9d4da5` reports **31** whitespace errors across
**5** drift files: `.kilo/team/COMMANDS/POST-TEAM-V2-PERFORMANCE-AUDIT-EDIT-REPAIR.md` (23),
`.kilo/team/TEAM-ORGANIZATION-V2-PROTOCOL.md` (3),
`.kilo/team/memory/README.md` (3),
`.kilo/team/TEAM-WORKER-V1-PROTOCOL.md` (1),
`Docs/HOOSHYAROS_MASTER_CHARTER.md` (1).

Same trailing-whitespace class as DEFECT-0001, now inside the governance and
memory layer the team itself owns, introduced by control-plane commits after
Wave 10 — not by Wave 10 workers. It does not block a fresh integrate (the
diff gate runs on the checkout tree, which is clean at START_SHA), but it means
the team diff gate cannot currently be enforced as a repository-wide invariant.

# FINDINGS

## F-1 (P0, CORRECTION) — BLOCKER-0001 and WAVE-0010 record a disproven cause

`blocker-registry.json` BLOCKER-0001 is titled "Wave 10 integration target
drift", P0, with a safe-unblock that presumes drift was observed. E5/E6/E7
disprove that:

- drift was never the cause of the integrate failure (exit 128, git identity);
- drift was never evaluated by recovery (`unbound variable`);
- a 2-file allowlist against 18 real drift paths would block recovery anyway.

Classification must become
`MISSING_GIT_COMMITTER_IDENTITY_IN_INTEGRATE_JOB`, with the drift-gate
misdesign split out as F-4. This correction belongs to WORK-0003, the owner of
`.kilo/team/memory/**`. WORK-0004 is REVIEW-only and made no memory edit.

## F-2 (P0, LIVE) — the Wave 10 root cause is still unrepaired

Re-verified at the current `origin/main` `0bfe3eae` (E9): no git identity is
configured in the integrate job, which still cherry-picks under
`set -euo pipefail`. Unrepaired. Untested end-to-end (E12) because no run has
reached integration since Wave 10.

## F-3 (P1, LIVE) — the recovery gate's shell-scope defect is still unrepaired

Re-verified at `0bfe3eae` (E9): identical bug, unchanged. Every subsequent
recovery run (`37778368278`, `37778364458`, and the earlier 09:48Z→12:38Z
series) is `skipped`, so this path has produced zero verified recoveries to
date. The one consumer that is broken is precisely the safety check recovery
exists to perform.

## F-4 (P1, DESIGN) — the drift gate is mis-scoped and can never pass

The gate compares *entire* cumulative drift since the worker's START_SHA
against a 2-file allowlist, so it rejects exactly the situation it was built
for. Real integration risk is the intersection of drift with (a) any worker
write scope and (b) protected paths — measured **empty** in E7. As written it
is fail-closed with no bounded path to PASS. The drift gate is also placed in a
later step than the cherry-pick loop (E5), so it cannot protect the mutation
it is meant to guard.

## F-5 (P1, DESIGN) — no atomic rollback; partial integration is unrepresentable

`set -euo pipefail` with an in-loop `git cherry-pick` means a mid-loop failure
leaves earlier cherry-picks applied and `CHERRY_PICK_HEAD` set, with no abort
and no reset. `test "${SUCCESS_COUNT}" -gt 0` would then report "0 integrated"
while the worktree actually contains commits — a state no later step
distinguishes from a clean one. Wave 10 escaped this only by failing on the
very first cherry-pick. It becomes dangerous the moment any best-effort push
is added downstream.

## F-6 (P2, LATENT FALSE-GREEN) — QC state accumulates across model attempts

The QC loop appends every attempt to one log and then tests for the presence
of `QC_DECISION=PASS` and absence of `QC_DECISION=FAIL`. Once any attempt emits
PASS, the gate is satisfied even if a later attempt emits FAIL. Wave 10 was
unaffected — PASS came from the final attempt and no attempt emitted FAIL — but
this ordering is unsafe in general and should be per-attempt.

## F-7 (P2, TRACEABILITY) — the QC verdict has no durable artifact

The Wave 10 run produced 12 `team-result-*` artifacts and **no** QC artifact
(verified: 12 artifacts, `expired=false`, all `expires_at 2027-01-06T07:30:15Z`).
The QC verdict is recoverable only from a job log. EVIDENCE-0001 therefore cites
a run id rather than a persisted report — verifiable today, one log-retention
window from unverifiable.

## F-8 (P2) — the governance layer is not diff-gate clean

E13: 31 whitespace errors across 5 governance/memory files. Same class as
DEFECT-0001. Does not block integration today; will block any future
tightening of the diff gate to repository scope.

## F-9 (P1, PROCESS) — completed worker evidence is stranded by run cancellation

E11 is the concrete instance: run `37776552275` committed complete evidence for
WORK-0003 (`509ce84c`) and WORK-0004 (`ba49094f`), then was cancelled before
`integrate`. Neither commit is an ancestor of this lease's START_SHA, so both
leases were re-executed from scratch. This is the mechanism by which the team
accrues duplicate work: **cancellation after the commit step, with no
reconciliation of already-committed evidence.** The next-wave plan and the V2
memory context gate do not currently treat an orphan branch carrying a valid
envelope as a reason to skip or to reconcile.

## F-10 (P2, TRACEABILITY) — architecture-governance evidence has one carrier

Its `result.md` exists only as CI artifact `team-result-architecture-governance`
(45152 bytes, `expired=false`, `expires_at 2027-01-06T07:30:15Z`). No branch, no
commit, so no governed recovery path can ever import it. After that date its
findings are unrecoverable and must be re-derived under a new lease rather
than assumed recoverable.

## F-11 (P3, THROUGHPUT) — QC latency is dominated by model timeouts

E4: two of three QC attempts consumed the full timeout budget, so roughly
22 of the 27 QC minutes were spent waiting on models rather than on checks.
A throughput fact for WORK-0006, not a correctness defect.

## F-12 (P1, MEMORY ACCURACY) — two ledgers disagree and both are stale

E12: `mission-state.current_run_id` and `wave-history.current.run_id` name two
different runs, both since cancelled, neither being the live run. BLOCKER-0002's
queue premise has been falsified by current run evidence. Memory accuracy is
the metric most damaged by this wave, and it is the input WORK-0006's Gate A
would otherwise adjudicate on.

# DEPENDENCIES

- **WORK-0003** (`READY`, PLANNER, owns `.kilo/team/memory/**`) — must consume
  F-1, F-12 and the BLOCKER-0002 staleness correction. BLOCKER-0001,
  BLOCKER-0002, `wave-history.json` WAVE-0010
  (`integration: FAIL_DUE_CONTROLLED_TARGET_DRIFT`) and the two disagreeing run
  ids all currently encode or assert something this review disproves or
  supersedes. Outside my WRITE_SCOPE; no memory file was edited here.
  Note WORK-0003's own evidence (`509ce84c`) is itself stranded (E11).
- **WORK-0006** (`PLANNED`, gate) — its `PRE-GATE-BASELINE.md` contains three
  claims this review contradicts: "Original Integrator job: FAIL due controlled
  target drift" (line 16), "Recovery workflow: executed and preserved evidence"
  (line 17), and the derived metrics rows "Integration Conflict Rate … caused
  by controlled target drift" (line 31) and "Recovery Capability … executed/
  preserved evidence" (line 32). Gate A must consume these corrections or it
  will adjudicate Team V2 on a disproven baseline. The baseline's `NO_INFERENCE_
  FROM_WAVE_0011 = TRUE` discipline is correct and should be kept.
- **WORK-0001** (`ACTIVE`, MISSION_DIRECTOR) — parent reconciliation. Not
  required for these findings to hold; every claim is anchored to immutable
  run/branch evidence.
- **WORK-0005** (`READY`, PLANNER) — its branch was cancelled mid-run with no
  branch left (E11), so it has no stranded evidence and is genuinely
  outstanding.
- **BLOCKER-0002** — orthogonal to Wave 10 conclusions but now stale (F-12).
- **COMMIT-0004** (`3535384c`, "controlled target-drift recovery") was authored
  at 2026-10-08 08:18Z, roughly 60s before the failing integrate job started,
  but the job executed the workflow from run headSha `629ef38f`. The repair
  landed too late and, per F-2/F-3, incompletely.
- Control-plane refs read read-only: `origin/main` = `0bfe3eae` (moved during
  this lease from `fdd289c2`); `origin/fix/autonomous-product-factory` =
  `6c9d4da5` (unchanged, equal to this lease's HEAD).

# RISKS

- **R-1 (HIGH)** — Any new wave that reaches integration will repeat the Wave 10
  failure (F-2). Impact bounded: evidence is stranded on worker branches
  exactly as Wave 10's is. No corruption, no product damage. But this run
  `37779956878` *will* reach integration, so the exposure is imminent, not
  hypothetical.
- **R-2 (HIGH)** — Wave 10 evidence can never be recovered through the governed
  path as written (F-3 + F-4). The 11 reports are demonstrably recoverable by
  cherry-pick, yet the gate can never pass. Continuing to record "recovery
  attempted" accrues unrecoverable accepted work indefinitely.
- **R-3 (HIGH)** — Completed evidence is repeatedly re-executed rather than
  reconciled (F-9). This is the mechanism generating the team's duplicate work
  rate, and it is invisible to the current performance metrics because the
  metric counts leases, not re-executions of already-committed work.
- **R-4 (MEDIUM)** — Partial integration is unrepresentable (F-5). Currently
  fails safe because the push step is downstream of the failing step; becomes
  dangerous the moment a best-effort push is introduced.
- **R-5 (MEDIUM)** — QC can be satisfied by a stale early PASS (F-6). Not
  triggered in Wave 10; becomes live whenever a fallback chain is used.
- **R-6 (MEDIUM)** — `architecture-governance` findings rest on a single
  expiring artifact (F-10). Unrecoverable after 2027-01-06.
- **R-7 (MEDIUM, PROCESS)** — Adjudicating WORK-0006 on the uncorrected
  baseline (F-1, DEPENDENCIES) is the highest-leverage near-term risk, because
  the wrong baseline is currently the gate's input.
- **R-8 (LOW)** — Governance layer not diff-gate clean (F-8).
- **R-9 (LOW)** — If the orphan branches `ba49094f` / `509ce84c` are left
  unretired, a future worker may treat them as current and re-derive from stale
  evidence. Retiring them is a control-plane action, deliberately not taken here.

# OVERLAPS

- **WORK-0003** — F-1, F-12 and the BLOCKER-0002 correction must be applied
  there, not here. Recorded explicitly as a dependency conflict rather than
  duplicated; I made no memory edit.
- **WORK-0006** — `PRE-GATE-BASELINE.md` overlaps E5, E6 and F-1. Recorded as a
  contradiction, not rewritten; Gate A owns adjudication.
- **Prior WORK-0004 attempt `ba49094f`** — overlapping by construction. I read
  it in full, independently re-derived every load-bearing claim, found its
  conclusions substantively correct, and superseded it with this report placed
  in the current lineage. Two of its claims required re-verification because
  `origin/main` moved (`fdd289c2` → `0bfe3eae`); both were re-checked and both
  defects remain live, so its F-2/F-3 conclusions still hold. Its E7 drift
  count (20), E8 recoverability (11/11) and F-8 whitespace counts
  (23/3/3/1/1) reproduced exactly. Its own F-9 numbering differs from mine; I
  renumbered, so treat this report's IDs as authoritative.
- **EVIDENCE-0001** (QC) and **DEFECT-0001** (whitespace) — re-verified, and
  both **stand**. No invalidation evidence. DEFECT-0001's "evidence report was
  preserved" is precise only when read as "preserved as a CI artifact" (F-10).
- **The eleven Wave 10 audit reports** — deliberately not read, re-audited or
  re-judged. Only envelope-level facts were used.
- No other lease's write scope overlaps
  `.kilo/team/results/work-0004-wave10-recovery/`.

# RECOMMENDED_NEXT_MICRO_STAGE

One Micro-Stage, one owner, one coherent commit, IMPLEMENT mode, on a
**protected-path control-plane lease**. This lease may not do it:
`TEAM-WORKER-V1.json` `protected_paths` includes `.github/**`.

**Title:** Control-plane repair of the integration, recovery and cancellation-
reconciliation gates.

**Owner:** ORCHESTRATOR / control plane.

**Scope, bounded to five defects:**

1. In `hooshyaros-team-worker.yml` `integrate`: set an explicit
   repository-local git committer identity before the cherry-pick loop (F-2).
2. In the same job: make the loop atomic — `git cherry-pick --abort` plus a
   reset to START_SHA on any failure, and report per-worker `INTEGRATED` counts
   that match reality (F-5).
3. In `hooshyaros-team-wave-recovery.yml`: `source`/`eval` the generated env in
   the step that needs it, or split the drift gate into its own step (F-3).
4. Replace the 2-file `SAFE` allowlist with an intersection test: fail only when
   a drift path falls inside a worker write scope or a protected path (F-4),
   and move the gate **before** the cherry-pick loop so it guards the mutation.
5. Audit every remaining `$GITHUB_ENV`-write-then-read-in-the-same-`set -u`
   step across team workflows, since this bug class already produced two
   separate failures (E6, E10) (F-3, E10).

**Verification contract:** for each item, a focused assertion on the changed
script plus one dry-run integration/recovery rehearsal proving (a) an
identity-less runner no longer aborts integration, (b) the Wave 10 envelope set
passes the repaired drift gate while a deliberately protected-path-touching
envelope is still rejected, and (c) a cancelled run that already committed
valid evidence is detected and reconciled rather than re-executed (F-9). Must
not be asserted from model output.

**Explicitly out of scope:** re-auditing the eleven reports, F-8 whitespace
cleanup of governance files (separate lease), product code, Architecture Freeze
V4/V4.1, governance charters, memory ledgers.

**Sequencing:** item 1 must land before this run's own `integrate` job, or
WAVE-0011 will strand its evidence exactly as Wave 10 did. Route F-1 and F-12 to
WORK-0003 in the same wave so Gate A is not adjudicated on a disproven
baseline. If the control-plane lease cannot be granted, the honest outcome is
`BLOCKED_CONTROL_PLANE` with this report as the evidence — not another wave that
will strand its evidence the same way.

# VERIFICATION_METHOD

Read-only reproduction plus one isolated rehearsal outside the repository. No
conclusion rests on model self-report, and no prior report was accepted without
independent re-derivation.

| Claim | Method | Result |
|---|---|---|
| 12 leases / 11 success / 1 failure / QC success / integrate failure / synthesize skipped | `gh run view 37743827267 --json jobs` | reproduced |
| integrate exit 128 from missing git identity | integrate job log, terminal lines | reproduced |
| recovery never evaluated drift (`unbound variable`) | run `37749071519` job log, line 51 | reproduced |
| 11 branches: uniform ancestry, 1 commit, 1 in-scope path, 0 protected paths, 0 whitespace errors | `git merge-base` / `git diff --name-only` / `git show --check` per branch | reproduced 11/11 |
| architecture-governance has no branch or commit | branch listing + artifact list | confirmed |
| QC PASS upheld; false-green hypothesis tested and rejected | QC job log, model-attempt timeline | reproduced |
| drift = 20 paths / 39 commits | `git diff --name-only 04119244...6c9d4da5` | reproduced |
| recovery allowlist blocks 18 of 20 drift paths → exit 42 | gate logic replayed against real drift list | allowed=2 blocked=18 |
| drift ∩ worker write scopes = ∅ | `comm` over drift and worker path sets | empty |
| Wave 10 recoverable onto current tip | detached worktree at `6c9d4da5`, 11 cherry-picks, removed and pruned | 11 ok / 0 fail |
| identity defect still live at current `origin/main` | `git show origin/main:.github/workflows/hooshyaros-team-worker.yml` | 0 identity matches, cherry-pick line 1095 |
| recovery scope defect still live at current `origin/main` | same, lines 88–90 | reproduced |
| `SYNTH_MODEL_CANDIDATES` worker-job defect existed and was fixed | workflow diff across `c45ca6d5..fdd289c2` | reproduced |
| WORK-0004 dispatched 3×; 2 orphan branches stranded; 1 cancelled with no branch | `gh run view` per run + branch listing + ancestry checks | reproduced |
| both BLOCKER-0002 runs cancelled; queue since cleared | `gh run view` per run + `gh run list` | reproduced |
| 12 artifacts, no QC artifact, none expired | `gh api …/actions/runs/37743827267/artifacts` | reproduced |
| governance-layer whitespace = 31 errors / 5 files | `git diff --check 04119244 6c9d4da5` | reproduced |

Proportionality: this is a REVIEW lease over immutable historical evidence, so
verification is read-only reproduction plus one isolated rehearsal. No product
test suite was executed because no product code changed. The rehearsal
worktree was deleted and pruned; `git status` is clean, `HEAD` is unchanged at
`6c9d4da5`, and no rehearsal ref remains.

# PROVENANCE

- START_SHA (given): `6c9d4da5b04a1063e9fe616c2b1c4d9fd072397b`
- HEAD at report time: `6c9d4da5b04a1063e9fe616c2b1c4d9fd072397b`
- Branch: `opencode/team-work-0004-wave10-recovery-37779956878`
- This lease's run: `37779956878`, headSha `fdd289c22e252243d85e660f6ed2997f50b89b62`,
  created `2026-10-08T12:51:59Z`, `in_progress` at report time
- Prior WORK-0004 attempt (read, re-verified, superseded): `ba49094f`, branch
  `origin/opencode/team-work-0004-wave10-recovery-37776552275`, merge-base with
  this START_SHA = `6c9d4da5`, **not** an ancestor of HEAD
- Stranded sibling evidence (not an ancestor of HEAD):
  `509ce84c` on `origin/opencode/team-work-0003-memory-backfill-37776552275`
- Wave 10 run: `37743827267`, headSha `629ef38f3dd259867c2167d8e21c47a0ed0c68e0`,
  Wave 10 `START_SHA` `04119244e326f498db21f81f0509dd8374e10cf5`,
  `TARGET_BRANCH` `fix/autonomous-product-factory`
- Wave 10 recovery run: `37749071519`, headSha `9a1f10a57088ae9dc410248dc65562d8252c4aec`
- Wave 10 worker branches reconciled: `7010e238` benchmark-123, `8fd23279`
  chart-gate, `1f9d025a` commercial-acceptance, `cf797986` information-flow,
  `654d17ab` intelligence-brain, `f14bcdeb` open-source-leverage,
  `5d2baf0a` performance-management, `d173e70f` process-architecture,
  `50dc9967` quality-harness, `9f22218e` reconciliation, `e226ad2d`
  report-presentation
- Wave 10 artifact set: 12 × `team-result-*` from run `37743827267`,
  `expired=false`, `expires_at 2027-01-06T07:30:15Z`
- Superseded/earlier team-worker runs inspected: `37776086347` (head
  `c45ca6d5`, worker failed), `37776552275` (head `fdd289c2`, cancelled),
  `37778251710`, plus `37760777088` and `37759400053` for BLOCKER-0002
- Control-plane refs read read-only: `origin/main` `fdd289c2` → `0bfe3eae`
  (moved during this lease); `origin/fix/autonomous-product-factory` `6c9d4da5`
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
- Scratch artifacts outside the repository: `/tmp/opencode/cp-rehearsal`
  (worktree, created and removed) and `/tmp/opencode/cp-*.log`.
- Secrets, personal data and customer financial data: none accessed,
  transmitted or written. `gh` was used read-only for run/job/log/artifact
  inspection; no workflow, manifest, secret, deployment setting or protected
  path was modified. No force-push, no reset, no history rewrite, no branch or
  ref deleted, no test weakened or deleted.