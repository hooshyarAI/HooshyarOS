# WORK-0003 — Legacy Work and Evidence Backfill — EVIDENCE REPORT

```text
WORKER_ID      = work-0003-memory-backfill
WORK_ID        = WORK-0003
ROLE           = Memory & Editor
OWNER_ENGINE   = MEMORY_EDITOR
MODE           = AUDIT
START_SHA      = 6c9d4da5b04a1063e9fe616c2b1c4d9fd072397b
RUN_ID         = 37776552275 (from branch opencode/team-work-0003-memory-backfill-37776552275)
WRITE_SCOPE    = [.kilo/team/memory/**, .kilo/team/results/work-0003-memory-backfill/]
TEAM_ORG       = V2
LEASE_STATE    = EXECUTED_AWAITING_QC
```

# STATUS

`EXECUTED_AWAITING_QC` — the memory backfill Micro-Stage is complete and verified. No product
implementation was performed. Independent QC and integrator promotion are **not** performed and are
not claimed.

The backfill found substantially more than a missing-records problem: it surfaced a **P0
target-lineage divergence** that had never been recorded in any ledger. That finding is the most
consequential output of this lease.

# SCOPE

Executed only the leased focus — backfill and reconcile the organizational ledgers from repository
evidence, preserve unknowns and stale states, no product implementation.

Written (all inside `WRITE_SCOPE`):

```text
.kilo/team/memory/README.md
.kilo/team/memory/mission-state.json
.kilo/team/memory/work-registry.json
.kilo/team/memory/evidence-registry.json
.kilo/team/memory/decision-registry.json
.kilo/team/memory/defect-registry.json
.kilo/team/memory/blocker-registry.json
.kilo/team/memory/commit-registry.json
.kilo/team/memory/wave-history.json
.kilo/team/results/work-0003-memory-backfill/result.md   (this report)
```

Explicitly **not** touched: `Backend/**`, `web/**`, `Assistant/**`, `Docs/**`, `AGENTS.md`,
`.github/**`, `package.json`, `package-lock.json`, `.kilo/plans/**`, `.kilo/evidence/**`, and every
governing charter. Verified mechanically (see `VERIFICATION_METHOD`). Architecture Freeze
V4/V4.1 unmodified. No test was modified, weakened or deleted. No merge, rebase, branch move,
force-push or history rewrite was performed. No secret, personal or customer financial data was
read or transmitted.

# CURRENT_EVIDENCE

All figures below are **FACT** derived from the repository at `START_SHA`. Every number is
reproducible from the cited command.

## Ledger state before this lease

| Ledger | Records | `next_id` | Gap observed at START_SHA |
|---|---|---|---|
| `mission-state.json` | n/a | n/a | two contradictory run IDs vs. the actual run; `last_control_plane_commit` 5 commits behind HEAD |
| `work-registry.json` | 7 | `WORK-0007` | `next_id` collided with the existing `WORK-0007` item |
| `evidence-registry.json` | 5 | `EVIDENCE-0006` | only 2 of 11 Wave-10 audits registered |
| `decision-registry.json` | 4 | `DECISION-0005` | no record of the backfill evidence rule actually being applied |
| `defect-registry.json` | 1 | `DEFECT-0002` | defects found by earlier waves were unregistered |
| `blocker-registry.json` | 2 | `BLOCKER-0003` | queue blocker superseded by later facts, unrecorded |
| `commit-registry.json` | 13 | `COMMIT-0014` | **11 Wave-10 worker commits + 37 V2 control-plane commits + 67 origin/main control-plane commits all unregistered** |
| `wave-history.json` | 1 (`WAVE-0010`) | `WAVE-0011` | `WAVE-0011` in use but not in the wave list; `next_id` collided; `WAVE-0001..0009` absent |

## Wave-10 evidence corpus recovered from git

`git for-each-ref refs/remotes/origin/opencode/team-*-37743827267` returns **11** branches. For each:

- exactly **one** commit;
- parent is the shared Wave-10 `START_SHA` `04119244e326f498db21f81f0509dd8374e10cf5`;
- exactly **one** changed path, under its own `.kilo/team/results/<worker>/` directory;
- write scopes are **disjoint** — zero collisions.

No branch exists for the 12th lease, consistent with the recorded 11/12 success and `DEFECT-0001`.
Absence of that branch is recorded as unknown-cause, not as a proven integration outcome.

**MEASURED RESULT — Wave-10 worker commits (all `NOT_PROMOTED`):**

| worker | commit | result path |
|---|---|---|
| benchmark-123 | `7010e238868826b1518e6c7218401f70c7ed1137` | `.kilo/team/results/benchmark-123/result.md` |
| chart-gate | `8fd2327919829622f6d5fe903e7cdbd2440a09a2` | `.kilo/team/results/chart-gate/result.md` |
| commercial-acceptance | `1f9d025ad7fb0a0a2b1ff9c56e51c2cd412e7bbb` | `.kilo/team/results/commercial-acceptance/result.md` |
| information-flow | `cf797986ff38b701707e12b8fa9f6cceac87bb13` | `.kilo/team/results/information-flow/result.md` |
| intelligence-brain | `654d17abda0e5da73a0040cfac061068fabe4493` | `.kilo/team/results/intelligence-brain/result.md` |
| open-source-leverage | `f14bcdeb0267a5af62ec47284452f2ad001e928b` | `.kilo/team/results/open-source-leverage/result.md` |
| performance-management | `5d2baf0ac169ae12f6c62cd3e4cf6133a097446e` | `.kilo/team/results/performance-management/result.md` |
| process-architecture | `d173e70f9cebb4aa6597ade5b880c0647487322f` | `.kilo/team/results/process-architecture/result.md` |
| quality-harness | `50dc9967975f83b7c49a39c8f470aa4c44458d8b` | `.kilo/team/results/quality-harness/result.md` |
| reconciliation | `9f22218e379ff9c0ad99103a1b7e21b1e35ee1d5` | `.kilo/team/results/reconciliation/result.md` |
| report-presentation | `e226ad2de36f0030910dae9ccc3dc07f1714ce4c` | `.kilo/team/results/report-presentation/result.md` |

None of these 11 result artifacts exists on the target branch at `START_SHA`. The only
`.kilo/team/results/` artifact present on the target branch is
`work-0006-team-performance-evaluation/PRE-GATE-BASELINE.md`.

## Ledger state after this lease

| Ledger | Records | `next_id` |
|---|---|---|
| `work-registry.json` | 7 | `WORK-0008` (collision repaired) |
| `evidence-registry.json` | 17 | `EVIDENCE-0018` |
| `decision-registry.json` | 9 | `DECISION-0010` |
| `defect-registry.json` | 5 | `DEFECT-0006` |
| `blocker-registry.json` | 4 | `BLOCKER-0005` |
| `commit-registry.json` | 126 | `COMMIT-0127` |
| `wave-history.json` | 2 (`WAVE-0010`, `WAVE-0011`) | `WAVE-0012` (collision repaired) |
| `mission-state.json` | n/a | n/a |

**126 commit records, all SHAs verified resolvable.**

# FINDINGS

### F1 — P0 — the repository has two divergent team-control-plane lineages, and memory described only one

**FACT**, reproducible:

```text
git merge-base --is-ancestor 6c9d4da5 origin/main            -> NO
git rev-parse --abbrev-ref HEAD                               -> opencode/team-work-0003-memory-backfill-37776552275
git log -1 --format=%H origin/fix/autonomous-product-factory  -> 6c9d4da5 (START_SHA is that branch tip)
git branch -r --contains 6c9d4da5                             -> origin/fix/autonomous-product-factory only (1 ref)
git ls-tree -r --name-only origin/main -- .kilo/team/memory/  -> (empty)
git merge-base HEAD origin/main                               -> 99542164a06f15aa4072a52b9debcf75125a358a (2026-08-28)
git rev-list --count HEAD..origin/main                        -> 79
git rev-list --count origin/main..HEAD                        -> 662
git log -1 --format=%H origin/main                             -> fdd289c22e252243d85e660f6ed2997f50b89b62
```

Consequences:

1. **The entire organizational memory tree exists only on `origin/fix/autonomous-product-factory`.**
   `origin/main` — the repository's default branch — contains **no** `.kilo/team/memory/` directory.
2. **10 of the 13 pre-existing commit-registry records (`COMMIT-0002`..`COMMIT-0011`) resolve only on
   `origin/main`** and are **not** ancestors of `START_SHA`. Their status values are preserved
   verbatim; only the lineage fact was added.
3. **12 `origin/main` team-control-plane commits post-date** the commit that `mission-state.json`
   named as `last_control_plane_commit` (`9151fe4d`): `c6676993`, `d14553ce`, `01ab0d59`,
   `6766e809`, `1fca304b`, `b72cb22e`, `89c80913`, `d3765999`, `850c7611`, `c62b2d28`, `c45ca6d5`,
   `fdd289c2`. Several are directly queue/runner governance changes, i.e. they bear on `BLOCKER-0002`.
4. `origin/main` commit subjects such as `fix(team): preserve target Team V2 branch during queue
   bootstrap` and `fix(team): stop bootstrap event storm and target governed branch` show the control
   plane was already fighting this exact target-selection problem.

**Recorded as:** `BLOCKER-0004` (P0, OPEN), `DEFECT-0005` (P0, OPEN), `EVIDENCE-0017`,
`DECISION-0009`, and `mission-state.target_lineage`.

**Deliberately not decided by this lease.** `mission-state.target_lineage.canonical_lineage` is
`UNDECIDED`. Naming the canonical lineage is MISSION_DIRECTOR/INTEGRATOR authority, and this lease is
MODE=AUDIT with a memory-only write scope. No merge, rebase, branch move or promotion was attempted.

### F2 — P1 — every Wave-10 evidence citation was unreachable from organizational memory

`EVIDENCE-0003` and `EVIDENCE-0004` cite `.kilo/team/results/benchmark-123/result.md` and
`.kilo/team/results/intelligence-brain/result.md`. **Neither path exists on the target branch at
`START_SHA`.** Both resolve only on unpromoted worker branches. Root cause is `BLOCKER-0001`.

**Recorded as:** `promotion_state = NOT_PROMOTED_TO_TARGET_BRANCH`,
`source_present_at_start_sha = false`, plus `source_resolvable_at` and `provenance_note` on both
records. **Their `VERIFIED` status was deliberately not changed** — the findings are real and
preserved; only their reachability changed.

### F3 — P1 — three contradictory run IDs for one current wave

```text
mission-state.json (before)  current_run_id        = 37760777088   (Run #16, queued, no runner)
wave-history.json  (before)  current.run_id        = 37759400053
this lease                    branch run id         = 37776552275   (executing, FACT)
```

**Recorded as:** `mission-state.current_run_id = 37776552275` with a full `run_id_history` array
preserving all three prior states and their reasons; `wave-history.current.run_id = 37776552275`;
`WAVE-0011` moved into the `waves` array with a three-attempt `run_attempts` history. The stale
`37759400053` attempt is recorded as `SUPERSEDED_OR_UNKNOWN` — no job evidence for it survives, so
its outcome is **not** guessed.

### F4 — P1 — commit registry was missing 115 control-plane commits

`git rev-list --count 3ebeaa1d~1..6c9d4da5` = **37** (V2 control-plane chain, all unregistered).
`git log START_SHA..origin/main` filtered to team/worker/opencode subjects = **67** (divergent
lineage, all unregistered). Plus **11** Wave-10 worker commits. **115 backfilled**, all with full
SHA, subject, date and provenance. The divergent set is derived from `git log` at run time, never
hand-typed, so provenance cannot drift from the repository.

### F5 — P2 — stable-ID allocation collisions

`work-registry.json.next_id` was `WORK-0007` while a `WORK-0007` item already existed.
`wave-history.json.next_id` was `WAVE-0011` while `WAVE-0011` was in use. Both corrected to the first
unused permanent ID (`WORK-0008`, `WAVE-0012`). Recorded as `DEFECT-0004`.

### F6 — P1 — `WORK-0003` ownership contradiction

`work-registry.json` named `WORK-0003.owner = PLANNER`; `NEXT-WAVE-PLAN.json` and the executed lease
both name `MEMORY_EDITOR`. V2 protocol makes MEMORY & EDITOR the single memory-integrity role.
Reconciled to `MEMORY_EDITOR` with `owner_correction` preserving `previous_owner` and the reason.
Mode also reconciled `RECONCILIATION → AUDIT` with `previous_mode` retained.

### F7 — P1 — wave-history gaps

`WAVE-0011` existed only in the `current` block, never in the `waves` list. Added, with the
Wave-10 lease-count reconciliation (12 recorded vs 11 surviving branches) and an explicit note that
the absent 12th branch is unknown-cause rather than a proven integration outcome.

### F8 — unknown history preserved, not reconstructed

`WAVE-0001`..`WAVE-0009` have **no** repository evidence at `START_SHA`. Recorded in
`wave-history.unknown_history` as permanently reserved IDs with reason and recorder. Nothing guessed.

### F9 — `BLOCKER-0002` only partially superseded

`BLOCKER-0002.status` moved to `PARTIALLY_SUPERSEDED`, with the original `evidence` block —
including the full queued-run list — **preserved byte-for-byte** — plus a `later_observation` block.
`WORK-0003` moved out of `affected_work` into `partially_unblocked_work`, because a V2 run
(`37776552275`) did obtain a runner and is executing. The observation explicitly records what is
**not** claimed: not that WAVE-0011 completed, not that QC passed, not that integration succeeded,
not that the other leases ran.

### F10 — `REPORT-####` / `RECOVERY-####` stable IDs have no ledger

`TEAM-ORGANIZATION-V2.json.stable_ids` declares `REPORT-####` and `RECOVERY-####`, but
`TEAM-ORGANIZATION-V2-PROTOCOL.md` enumerates exactly eight canonical memory ledgers and neither
namespace has one. **No ninth ledger was created** — that would introduce exactly the parallel
governance hierarchy V2 forbids. Recorded as `DECISION-0008`: those namespaces remain unused rather
than invented.

### F11 — backfill scope honestly declared partial

`README.md` moves `BACKFILL_STATUS` from `STARTED` to `TEAM_DOMAIN_BACKFILLED` and states explicitly
what is **not** covered: the pre-V2 product-era work, its 1541-commit history and the 60
`.kilo/evidence/*` artifacts are not reconstructed and remain unknown. `NEXT_BACKFILL_WORK =
NONE_IN_TEAM_DOMAIN`. No completeness claim was manufactured.

# DEPENDENCIES

- `WORK-0002` (Team Organization V2 Operationalization) — satisfied; its ledgers are the substrate.
- `TEAM-ORGANIZATION-V2-PROTOCOL.md` — memory ledgers are exactly the eight files above.
- `NEXT-WAVE-PLAN.json` — source of the three `WAVE-0011` leases; `created_from_sha` =
  `e564682ad02df31adc458995d4232128c7fa0fd3`, which is an ancestor of `START_SHA`.
- `BLOCKER-0001` — the unpromoted Wave-10 evidence is its direct consequence.
- `BLOCKER-0004` (new, P0) — blocks any authoritative cross-lineage memory claim.
- No code, workflow or manifest consumes these ledgers (`grep` across `.github/workflows/**`,
  `scripts/**`, `Backend/**`, `web/**` returned no consumer), so additive JSON changes carry no
  runtime coupling risk.

# RISKS

| # | Risk | Severity | Mitigation applied |
|---|---|---|---|
| R1 | A reader treats memory as authoritative for `origin/main` | P0 | `mission-state.target_lineage`, `BLOCKER-0004`, `DEFECT-0005`, `truth_note` all scope claims to the `START_SHA` lineage |
| R2 | Wave-10 findings are re-run because their reports are "missing" | P1 | all 11 registered with branch provenance; `BLOCKER-0003` safe-unblock forbids re-running and permits only citation-path change |
| R3 | A queued run is misread as executed or failed | P1 | `run_attempts` and `run_id_history` distinguish `QUEUED_NO_RUNNER_ALLOCATED`, `EXECUTING` and `SUPERSEDED_OR_UNKNOWN`; no outcome inferred |
| R4 | 67 divergent-lineage commits dilute the registry | P2 | tagged `lineage: ORIGIN_MAIN`, `in_start_sha_lineage: false`, `linked_blocker: BLOCKER-0004`; derived from `git log`, never hand-typed |
| R5 | Backfill over-reaches into product work | — | write scope is memory-only and mechanically verified; no product path touched |
| R6 | Repairing memory makes a failure look successful | P0 | `WAVE-0010` status/`FAIL_DUE_CONTROLLED_TARGET_DRIFT`, `BLOCKER-0001`, `BLOCKER-0002` evidence and all pre-existing statuses asserted unchanged by the verifier |
| R7 | This lease becomes the de-facto lineage decision | P0 | `canonical_lineage: UNDECIDED`; `DECISION-0009` forbids naming it or merging from this lease |

# OVERLAPS

- **WORK-0004 (INTEGRATOR)** — `BLOCKER-0001` recovery and the promotion of the 11 QC-passed
  Wave-10 artifacts are `WORK-0004`'s remit. This lease only **recorded** the promotion state and
  created `BLOCKER-0003`; it did not promote, reconcile or re-adjudicate any Wave-10 finding.
- **WORK-0005 (PLANNER)** — next-capability selection needs the recovered Wave-10 evidence corpus.
  This lease made that corpus citable; it made no capability selection.
- **WORK-0006 (MISSION_DIRECTOR)** — gate metrics include `MEMORY_ACCURACY`, previously `NOT_MEASURED`.
  The pre-gate baseline is untouched; this lease supplies the ledger state that a final Gate A
  adjudication would consume. **No gate verdict is claimed.**
- **WORK-0001** — `DEFECT-0005` is filed with `fix_work: WORK-0001`, but reconciliation itself is
  outside this lease.
- **SELF-OVERLAP, recorded not hidden:** the work registry named `WORK-0003.owner = PLANNER` while
  the executed lease is `MEMORY_EDITOR` (F6). Reconciled with full provenance rather than silently
  overwritten.
- **CONTRADICTION, recorded not hidden:** `BLOCKER-0001` (Wave-10 integration drift) and
  `BLOCKER-0004` (lineage divergence) are distinct blockers with a common symptom. They are linked
  via `corroborates` but not merged.

# RECOMMENDED_NEXT_MICRO_STAGE

**Governed decision on the canonical target lineage, then controlled integration of the memory
ledgers into it** — owned by MISSION_DIRECTOR with INTEGRATOR execution, before `WORK-0006`'s Gate A.

Rationale, in strict priority order:

1. `BLOCKER-0004` / `DEFECT-0005` (P0) make every downstream memory claim lineage-ambiguous. No
   quality or performance gate can be adjudicated while two control planes coexist.
2. `WORK-0004` must then reconcile and promote the 11 Wave-10 artifacts, closing `BLOCKER-0003` and
   `DEFECT-0005`'s promotion consequence.
3. Only then `WORK-0005` (next genuinely missing capability) and the `WORK-0006` gate.

Not recommended and not started: any product implementation. `WORK-0007` remains gated by
`WORK-0006`, and `DECISION-0004` still forbids restarting accepted F1/F6/CCC/UX work without
regression or invalidation evidence.

# VERIFICATION_METHOD

Proportional verification, executed before finalisation. Result: **PASS** (38 assertions).

```text
python3 /tmp/opencode/verify_work0003.py     # exit 0
```

| Assertion group | Result |
|---|---|
| All 8 canonical ledgers parse as valid JSON | PASS |
| All 126 registered commit SHAs resolve to real commits (`git cat-file -t`) | PASS |
| Stable IDs unique, never recycled, per ledger | PASS |
| Every `next_id` is free (no collision) | PASS |
| All 11 Wave-10 worker commits registered | PASS |
| Pre-existing statuses preserved: `EVIDENCE-0001..0005`, `DEFECT-0001`, `COMMIT-0001`, `COMMIT-0006`, `BLOCKER-0001` | PASS |
| `WAVE-0010` status and `FAIL_DUE_CONTROLLED_TARGET_DRIFT` preserved | PASS |
| `BLOCKER-0002` original `runner_allocated: false` evidence preserved verbatim | PASS |
| Write scope: all changed paths inside `.kilo/team/memory/**` and this results directory | PASS |
| No protected path (`Backend/`, `web/`, `Assistant/`, `Docs/`, `AGENTS.md`, `.github/`, manifests, `.kilo/plans/`, `.kilo/evidence/`) modified | PASS |
| No out-of-scope untracked files | PASS |

Repository commands used as evidence: `git log --format`, `git rev-list --count`,
`git merge-base --is-ancestor`, `git merge-base`, `git for-each-ref`, `git cat-file -t`,
`git show --name-only`, `git ls-tree`, `git branch -r --contains`, `git diff --name-only`,
`git ls-files --others --exclude-standard`.

Derivation scripts (outside the repository, per the write scope): `/tmp/opencode/backfill_work0003.py`,
`/tmp/opencode/backfill_work0003_stage2.py`, `/tmp/opencode/verify_work0003.py`.

**Verification limits, stated honestly.** Ledger integrity is verified; product behaviour is not
tested because this lease changed no product code and MODE=AUDIT forbids product implementation.
Worker prose was never used as a source of completion. The pre-existing worker findings summarised
in the evidence registry were read from the worker artifacts themselves, not from their status lines
alone.

# PROVENANCE

- `START_SHA = 6c9d4da5b04a1063e9fe616c2b1c4d9fd072397b`, verified equal to `git rev-parse HEAD` at
  lease start.
- Branch: `opencode/team-work-0003-memory-backfill-37776552275`; run id `37776552275` read from the
  branch name.
- Wave-10 `START_SHA = 04119244e326f498db21f81f0509dd8374e10cf5`, verified as the parent of all 11
  worker commits.
- Divergent lineage: `merge-base 99542164a06f15aa4072a52b9debcf75125a358a` (2026-08-28);
  `origin/main` tip `fdd289c22e252243d85e660f6ed2997f50b89b62`;
  `origin/fix/autonomous-product-factory` tip `6c9d4da5b04a1063e9fe616c2b1c4d9fd072397b`.
- V2 control-plane range: `3ebeaa1d1e19eecad98201ff56666f1db778de06..6c9d4da5` (37 commits, linear,
  no merges).
- All new records carry `recorded_by = work-0003-memory-backfill`; commits carry exact SHA, subject,
  date and derivation command.
- **Provenance defect, not repaired by this lease:** 9 of the 11 Wave-10 result artifacts were read
  directly from the remote worker branches because they are absent from `START_SHA`. Their content
  is therefore branch-scoped evidence, not a target-branch fact, and every such record says so.
- `WORKER_STATE = ADVANCED` with `LEASE_STATE = EXECUTED_AWAITING_QC`. One coherent commit. No
  promotion performed. No human action required for this Micro-Stage.