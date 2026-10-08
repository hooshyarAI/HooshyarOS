# WORK-0003 — Legacy Work and Evidence Backfill — EVIDENCE REPORT

```text
WORKER_ID      = work-0003-memory-backfill
WORK_ID        = WORK-0003
ROLE           = Memory & Editor
OWNER_ENGINE   = MEMORY_EDITOR
MODE           = AUDIT
FOCUS          = Backfill and reconcile organizational ledgers from repository evidence;
                 preserve unknowns and stale states; no product implementation
START_SHA      = 6c9d4da5b04a1063e9fe616c2b1c4d9fd072397b   (verified == git rev-parse HEAD)
RUN_ID         = 37779956878  (read from branch opencode/team-work-0003-memory-backfill-37779956878)
WRITE_SCOPE    = [.kilo/team/memory/**, .kilo/team/results/work-0003-memory-backfill/]
TEAM_ORG       = V2
LEASE_STATE    = EXECUTED_AWAITING_QC
WORKER_STATE   = ADVANCED
```

# STATUS

`EXECUTED_AWAITING_QC` — the memory backfill Micro-Stage is complete. No product implementation was
performed. Independent QC, integration and promotion are **not** performed by this lease and are
**not** claimed.

The decisive fact discovered before writing anything: **this exact lease had already been executed
once and never promoted** (`509ce84c`, run `37776552275`, identical `START_SHA`). That prior attempt
is not an ancestor of this branch, was never QC-adjudicated and was never promoted, so it was neither
`DONE` nor `VERIFIED` nor `ACCEPTED` and did not bar this run — but its existence was recorded in no
ledger, which is exactly how a third blind re-run would have happened. Installing that guard is the
single most valuable output of this lease.

Method was **reuse-and-verify, not regenerate**: the prior attempt's ledger content was read from the
git object database, treated as evidence, and every material claim re-derived independently in this
run. Three of its numeric claims were stale and are corrected here.

# SCOPE

Executed only the leased focus. Written, all inside `WRITE_SCOPE`:

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

Explicitly not touched: `Backend/**`, `web/**`, `Assistant/**`, `Docs/**`, `Architecture/**`,
`AGENTS.md`, `.github/**`, `package.json`, `package-lock.json`, `.kilo/plans/**`,
`.kilo/evidence/**`, `.kilo/team/*.json`, `.kilo/team/COMMANDS/**`. Verified mechanically (§
VERIFICATION_METHOD). Architecture Freeze V4/V4.1 unmodified; no governance authority modified; no
test modified, weakened or deleted; no merge, rebase, branch move, force-push or history rewrite.

# CURRENT_EVIDENCE

All facts below are **FACT**, re-derived in this run, not carried over from the prior attempt.

## Ledger state at START_SHA

| Ledger | Records | `next_id` | Defect observed |
|---|---|---|---|
| `work-registry.json` | 7 | `WORK-0007` | `next_id` collided with the existing `WORK-0007` item; WORK-0003 `owner`/`mode` contradicted the lease |
| `evidence-registry.json` | 5 | `EVIDENCE-0006` | 2 of 11 Wave-10 audits registered; both cite paths absent from this branch |
| `decision-registry.json` | 4 | `DECISION-0005` | backfill evidence rule applied in practice but never recorded |
| `defect-registry.json` | 1 | `DEFECT-0002` | defects found by earlier waves unregistered |
| `blocker-registry.json` | 2 | `BLOCKER-0003` | queue blocker superseded by later facts, unrecorded; lineage divergence unknown |
| `commit-registry.json` | 13 | `COMMIT-0014` | **11 Wave-10 worker + 35 V2 control-plane + 80 divergent-lineage + 2 prior unpromoted attempts all unregistered** |
| `wave-history.json` | 1 (`WAVE-0010`) | `WAVE-0011` | `WAVE-0011` in use but absent from `waves`; `next_id` collided; `WAVE-0001..0009` unknown |
| `mission-state.json` | n/a | n/a | three contradictory run IDs; `current_wave_state` QUEUED; `last_control_plane_commit` not an ancestor of this branch |

## Independently re-verified lineage facts

```text
git rev-parse HEAD                                          -> 6c9d4da5b04a1063e9fe616c2b1c4d9fd072397b  (== START_SHA)
git rev-parse origin/fix/autonomous-product-factory         -> 6c9d4da5b04a1063e9fe616c2b1c4d9fd072397b  (this lineage's tip)
git merge-base HEAD origin/main                             -> 99542164a06f15aa4072a52b9debcf75125a358a  (2026-08-28)
git rev-list --count HEAD..origin/main                      -> 80
git rev-list --count origin/main..HEAD                      -> 662
git log -1 --format=%H origin/main                          -> 0bfe3eae515f58168b230d28895676353e3ba889
git ls-tree -r --name-only origin/main -- .kilo/team/memory -> (empty)
git merge-base --is-ancestor 9151fe4d HEAD                  -> exit 1  (NOT an ancestor)
git branch -r --contains 6c9d4da5                           -> 3 refs (fix branch + 2 unpromoted team runs)
git rev-list --count 3ebeaa1d~1..6c9d4da5                    -> 37  (V2 control-plane chain, all in-lineage)
git for-each-ref refs/remotes/origin/opencode/team-*-37743827267 -> 11 branches, 11 commits, 1 file each
                                                        all 11 share parent 04119244e326f498db21f81f0509dd8374e10cf5
origin/main team commits newer than 9151fe4d                -> 13
10 of the 13 pre-existing commit-registry SHAs resolve only on origin/main
0 of the 11 Wave-10 result paths exist in this branch's tree
0 consumers of the ledgers exist in .github/workflows/** or any code path
```

## Ledger state after this lease

| Ledger | Records | `next_id` |
|---|---|---|
| `work-registry.json` | 7 | `WORK-0008` (collision repaired, IDs contiguous) |
| `evidence-registry.json` | 18 | `EVIDENCE-0019` |
| `decision-registry.json` | 10 | `DECISION-0011` |
| `defect-registry.json` | 6 | `DEFECT-0007` |
| `blocker-registry.json` | 4 | `BLOCKER-0005` |
| `commit-registry.json` | 141 | `COMMIT-0142` |
| `wave-history.json` | 2 (`WAVE-0010`, `WAVE-0011`) + 9 reserved-unknown | `WAVE-0012` (collision repaired) |

141 commit records, every SHA machine-verified to resolve to a real commit.

# FINDINGS

### F1 — P0 — this lease had already run once and was never promoted

**FACT.** `origin/opencode/team-work-0003-memory-backfill-37776552275` contains `509ce84c`,
`memory(team): backfill V2 ledgers and record target-lineage divergence`, whose own message declares
`WORK-0003 / lease work-0003-memory-backfill / MODE=AUDIT / OWNER=MEMORY_EDITOR` with the **identical
`START_SHA`**. `git merge-base --is-ancestor 509ce84c HEAD` exits non-zero.

Consequence: no ledger recorded that WORK-0003 was attempted, so the dispatch anti-duplication gate
could not see it. **Recorded as:** `EVIDENCE-0018`, `COMMIT-0140`, `DECISION-0010`, and
`work-registry.WORK-0003.execution_attempts` (both runs, with QC and promotion state per run).

Anti-duplication reasoning, stated explicitly rather than assumed: the V2 rule forbids repeating
`DONE`/`VERIFIED`/`ACCEPTED`/`SUPERSEDED`/`DUPLICATE` work without regression or invalidation
evidence. The prior attempt was **none** of those states — it was `EXECUTED_UNPROMOTED` with
`qc: NOT_PERFORMED`. Repeating it was therefore permitted, and the repetition is now recorded so a
third dispatch cannot silently repeat it either. `WORK-0003.anti_duplication_state` reads
`REGRESSION_OR_INVALIDATION_NOT_PRESENT_BUT_NOT_DONE_EITHER`.

### F2 — P0 — the repository has two divergent team-control-plane lineages and memory described only one

**FACT**, reproduced above: all eight organizational memory ledgers exist **only** on this lineage
(`origin/fix/autonomous-product-factory`, tip = `START_SHA`). `origin/main` — the repository's default
branch — contains **no** `.kilo/team/memory/` path at all, and carries **80** commits this lineage has
never seen, of which **13** are newer than the commit `mission-state.json` named as
`last_control_plane_commit`. Several of those 13 are queue/runner governance changes
(`d14553ce`, `01ab0d59`, `b72cb22e`, `89c80913`, `0bfe3eae`), i.e. they bear directly on
`BLOCKER-0002`.

**Recorded as:** `BLOCKER-0004` (P0, OPEN), `DEFECT-0002` (P0, OPEN), `EVIDENCE-0017`,
`DECISION-0008`, and `mission-state.target_lineage`.

**Deliberately not decided.** `canonical_lineage = UNDECIDED`. Naming it is
MISSION_DIRECTOR/INTEGRATOR authority; this lease is `MODE=AUDIT` with a memory-only write scope and
performed no merge, rebase, branch move or promotion.

### F3 — P1 — every Wave-10 evidence citation was unreachable from organizational memory

`EVIDENCE-0003` and `EVIDENCE-0004` cite `.kilo/team/results/benchmark-123/result.md` and
`.kilo/team/results/intelligence-brain/result.md`. Neither path exists in this branch's tree; both
resolve only on unpromoted worker branches.

All 11 Wave-10 audits are now registered (`EVIDENCE-0006`..`EVIDENCE-0016`) with commit SHA, remote
ref, result path and a one-line finding read **from the worker artifact itself**, not from a status
line. Each carries `promotion_state: NOT_PROMOTED_TO_TARGET_BRANCH`,
`source_present_at_start_sha: false` and a provenance caveat that it is branch-scoped evidence, not a
fact about this branch. **Their statuses were not changed.** `BLOCKER-0003` records the persistence
of `BLOCKER-0001` and forbids re-running them.

### F4 — P1 — three contradictory run IDs for one wave, plus one fourth

`mission-state` said `37760777088` (Run #16, queued, no runner); `wave-history.current` said
`37759400053`; the previously executing branch carried `37776552275`; this run is `37779956878`.

**Recorded as:** `mission-state.current_run_id = 37779956878` with `run_id_history` (all four, with
reasons) and `current_run_id_previous = 37760777088`; `wave-history.WAVE-0011.run_attempts` (all
four, with reasons). `37759400053` is `SUPERSEDED_OR_UNKNOWN` — no surviving job evidence, outcome
**not** guessed. `37776552275` is `EXECUTED_UNPROMOTED`. **DEFECT-0005** (run IDs) and **DEFECT-0006**
(wave list), closed with provenance.

### F5 — P1 — `WAVE-0011` was never in the wave list

It existed only in the `current` block. Added to `waves` with its three leases, four run attempts and
an explicit `completion_not_claimed: true`. `WAVE-0001`..`WAVE-0009` are recorded in
`wave-history.unknown_history` as `PERMANENTLY_UNKNOWN` — reserved, never reconstructed, never reused.
**DEFECT-0006** also records that Wave-10's 12 leases produced only 11 surviving branches and that
the absent branch is **unknown-cause, not a proven integration outcome**.

### F6 — P1 — `WORK-0003` ownership and mode contradiction

`work-registry` named `owner = PLANNER`, `mode = RECONCILIATION`; `NEXT-WAVE-PLAN.json` and the
executed lease name `owner = MEMORY_EDITOR`, `mode = AUDIT`.
`TEAM-ORGANIZATION-V2-PROTOCOL.md` makes MEMORY & EDITOR the single memory-integrity role, and this
lease writes only memory. Reconciled with `previous_owner` and `previous_mode` retained, and with
`write_scope` corrected — the registry scope had omitted the lease result directory that MODE
requires. **DEFECT-0004**.

### F7 — P2 — stable-ID allocation collisions, and an off-by-one this lease introduced and caught

`work-registry.next_id` was `WORK-0007` while a `WORK-0007` item existed; `wave-history.next_id` was
`WAVE-0011` while `WAVE-0011` was in use. Repaired, and every `next_id` is now **derived** from the
highest used ID rather than hand-maintained.

**Self-reported defect, preserved rather than hidden:** the first implementation of this lease
allocated IDs by advancing the counter *before* assigning, which left one permanent ID unused and made
the emitted `next_id` collide with the last assigned record. The lease's own verifier caught it
(`G4-nextid-free-*`, 6 failures). It was fixed at source and both ledgers were regenerated from a
clean `git checkout` baseline. This is exactly the false-green the mode contract forbids, caught
mechanically rather than by reading prose.

### F8 — P1 — `BLOCKER-0002` is only partially superseded

A runner **has** now been allocated (runs `37776552275` and `37779956878`), so the original
"no runner allocated" blocker is partially lifted. Its status moved to `PARTIALLY_SUPERSEDED` and its
`evidence` block — including `runner_allocated: false` and all 17 queued run ids — is preserved
**byte-for-byte** as the correct record of the 2026-10-08 observation at that time.
`later_observation.what_is_NOT_claimed` explicitly disclaims: WAVE-0011 completion, QC pass,
integration success, WORK-0004/WORK-0005 evidence, and queue drain. The residual queue pressure is
real — two duplicate Team runs of the same lease happened inside one queue storm.

### F9 — P2 — `REPORT-####` / `RECOVERY-####` have no ledger

`TEAM-ORGANIZATION-V2.json.stable_ids` declares both; `TEAM-ORGANIZATION-V2-PROTOCOL.md` enumerates
exactly eight canonical ledgers and neither namespace has one. **No ninth ledger was created** — that
would introduce exactly the parallel governance hierarchy V2 forbids. **DECISION-0007**: the
namespaces stay unbacked rather than invented.

### F10 — P2 — `BACKFILL_STATUS = STARTED` was an unmeasured claim

`README.md` now states `TEAM_DOMAIN_BACKFILLED / PRODUCT_ERA_UNKNOWN` and lists explicitly what is
**not** covered: the Wave-10 artifacts are branch-scoped; `WAVE-0001..0009` are permanently unknown;
the pre-V2 product era, its **1541**-commit history and the **60** `.kilo/evidence/` artifacts are not
reconstructed; `REPORT-####`/`RECOVERY-####` stay unbacked; the canonical lineage is undecided. No
completeness claim was manufactured.

### F11 — provenance caveat inside the Wave-10 corpus

The Wave-10 report for `intelligence-brain` states `WORKER_BRANCH = opencode/team-intelligence-brain-v1`,
but the branch that actually carries its commit is `opencode/team-intelligence-brain-37743827267`.
The commit SHA, parent and result path are verified; only the worker's self-reported branch label is
inconsistent. Recorded as a provenance caveat on `EVIDENCE-0010` rather than corrected, because
rewriting a worker's own artifact is not this role's authority.

# DEPENDENCIES

- `WORK-0002` (Team Organization V2 Operationalization) — satisfied; its eight ledgers are the substrate.
- `TEAM-ORGANIZATION-V2-PROTOCOL.md` — the canonical ledger set is exactly the eight files above.
- `.kilo/team/NEXT-WAVE-PLAN.json` — source of this lease; `created_from_sha =
  e564682ad02df31adc458995d4232128c7fa0fd3`, verified an ancestor of this branch.
- `BLOCKER-0001` → `BLOCKER-0003` — direct cause of the unpromoted Wave-10 evidence.
- `BLOCKER-0004` (new, P0) — blocks any authoritative cross-lineage memory claim.
- `WORK-0003.execution_attempts` → the prior unpromoted attempt `509ce84c`, reused as evidence.
- **No code, workflow or manifest consumes these ledgers.** Verified: the only references to
  `memory_root` are `TEAM-WORKER-V1.json:108` and `TEAM-ORGANIZATION-V2.json`, both a path string, and
  `grep -rIn 'team/memory|work-registry|mission-state|evidence-registry|blocker-registry' .github/`
  returns nothing. Additive JSON changes therefore carry no runtime coupling risk.

# RISKS

| # | Risk | Severity | Mitigation applied |
|---|---|---|---|
| R1 | Memory is read as authoritative for `origin/main` | P0 | `target_lineage.canonical_lineage = UNDECIDED`, `BLOCKER-0004`, `DEFECT-0003`, `truth_note` and `README.md` all scope claims to this lineage |
| R2 | A third blind re-run of this lease | P0 | `WORK-0003.execution_attempts` + `EVIDENCE-0018` + `DECISION-0010` make the prior attempt visible to the dispatch gate |
| R3 | The prior attempt is trusted because it looks thorough | P0 | reused as evidence only; every material claim re-derived; 3 stale numbers corrected; 1 of its own claims found self-inconsistent |
| R4 | Wave-10 audits are re-run because their reports look "missing" | P1 | all 11 registered with branch provenance; `BLOCKER-0003` safe-unblock permits citation change, not re-audit |
| R5 | A queued run is misread as executed or failed | P1 | `run_attempts` / `run_id_history` distinguish `SUPERSEDED_OR_UNKNOWN`, `QUEUED_NO_RUNNER_ALLOCATED`, `EXECUTED_UNPROMOTED`, `EXECUTING`; no outcome inferred |
| R6 | Repairing memory makes a failure look successful | P0 | verifier asserts pre-existing statuses unchanged: all 13 `COMMIT-0001..0013`, `EVIDENCE-0001..0005`, `DEFECT-0001`, `BLOCKER-0001`, `BLOCKER-0002` original evidence, `WAVE-0010` status / `FAIL_DUE_CONTROLLED_TARGET_DRIFT` / `NOT_RELEASED_FROM_PRIMARY_RUN` |
| R7 | 80 divergent-lineage commits dilute the registry | P2 | each tagged `lineage: ORIGIN_MAIN`, `in_start_sha_lineage: false`, `linked_blocker: BLOCKER-0004`; derived from `git rev-list`, never hand-typed |
| R8 | Backfill over-reaches into product work | — | write scope is memory-only and mechanically asserted per changed path |
| R9 | This lease becomes the de-facto lineage decision | P0 | `canonical_lineage: UNDECIDED`; `DECISION-0008` forbids naming it or merging from this lease |

# OVERLAPS

- **SELF-OVERLAP with the prior unpromoted attempt of the same lease** — recorded, not hidden (F1).
  The repeat is disclosed with both runs, both commits and both states in `execution_attempts`.
- **WORK-0004 (INTEGRATOR)** — promotion of the 11 Wave-10 artifacts and `BLOCKER-0001` recovery are
  WORK-0004's remit. This lease only **recorded** promotion state and opened `BLOCKER-0003`. It
  promoted nothing and re-adjudicated no Wave-10 finding. A prior WORK-0004 attempt exists
  (`ba49094f`, run `37776552275`, unpromoted) and is registered as `COMMIT-0141` with
  `owner_of_reconciliation: WORK-0004_INTEGRATOR` so it is not mistaken for this lease's output.
- **WORK-0005 (PLANNER)** — next-capability selection needs the Wave-10 corpus. This lease made it
  citable; it selected no capability.
- **WORK-0006 (MISSION_DIRECTOR)** — Gate A consumes `MEMORY_ACCURACY`, previously `NOT_MEASURED`.
  The pre-gate baseline was not touched and **no gate verdict is claimed**.
- **WORK-0001** — `DEFECT-0002` is filed with `fix_work: GOVERNED_MISSION_DIRECTOR_LINEAGE_DECISION`;
  reconciliation itself is outside this lease.
- **CONTRADICTION, recorded not merged** — `BLOCKER-0001` (Wave-10 target drift) and `BLOCKER-0004`
  (lineage divergence) share a symptom but are distinct causes. They are linked via `corroborates`,
  not collapsed.
- **NOT OVERLAPPED** — `NEXT-WAVE-PLAN.json`, `TEAM-ORGANIZATION-V2.json`,
  `TEAM-ORGANIZATION-V2-PROTOCOL.md` and the mission plan all carry current-state claims that this
  backfill now contradicts (e.g. `CURRENT_WAVE_STATE = WAVE-0011_READY_FOR_DISPATCH`, and
  `origin/main`'s own queue governor). They are outside `WRITE_SCOPE` and were **not** modified. This
  is a known, deliberate residual inconsistency for the owner of those files.

# RECOMMENDED_NEXT_MICRO_STAGE

**Governed decision on the canonical target lineage**, owned by `MISSION_DIRECTOR` with `INTEGRATOR`
execution, followed by controlled reconciliation of the memory ledgers into it. Then `WORK-0004`.

Rationale, in strict priority order:

1. `BLOCKER-0004` / `DEFECT-0002` (P0). Every downstream memory claim is lineage-ambiguous while two
   control planes coexist, and `origin/main` has independently added 13 newer queue/runner governance
   commits — including one that "preserve[s] target Team V2 branch during queue bootstrap" and one
   that "stop[s] bootstrap event storm and target[s] governed branch", which is the same
   target-selection problem this repository has already hit twice.
2. `WORK-0004` must then reconcile and promote the 11 Wave-10 artifacts, closing `BLOCKER-0003` and
   the promotion consequence of `DEFECT-0002`.
3. Only then `WORK-0005` (next genuinely missing capability) and the `WORK-0006` Gate A adjudication.

Not recommended and not started: any product implementation. `WORK-0007` remains gated by `WORK-0006`,
and `DECISION-0004` still forbids restarting accepted F1/F6/CCC/UX work without regression or
invalidation evidence.

# VERIFICATION_METHOD

Proportional verification. Product behaviour was not tested because this lease changed no product code
and `MODE=AUDIT` forbids product implementation; ledger integrity, provenance and write-scope
compliance were verified mechanically instead. Worker prose was never used as a source of completion.

```text
python3 /tmp/opencode/verify_0003_run2.py     -> exit 0
```

**Result: PASS — 112 assertions, 0 failures.**

| Assertion group | Result |
|---|---|
| All 8 canonical ledgers parse as valid JSON | PASS |
| All 141 registered commit SHAs resolve to real commits (`git cat-file -t`) | PASS |
| Stable IDs unique and contiguous per ledger; `COMMIT-0001..0013` unchanged | PASS |
| Every `next_id` free (no collision, no gap) — derived, not hand-set | PASS |
| All 11 Wave-10 worker commits registered as `WORKER_COMMIT_NOT_PROMOTED` | PASS |
| Pre-existing statuses preserved: `EVIDENCE-0001..0005`, `DEFECT-0001`, `BLOCKER-0001`, `COMMIT-0001..0013` | PASS |
| `WAVE-0010` status, `FAIL_DUE_CONTROLLED_TARGET_DRIFT`, `NOT_RELEASED_FROM_PRIMARY_RUN` preserved | PASS |
| `BLOCKER-0002` original evidence preserved: `runner_allocated: false`, 17 queued run ids, first/last values, `9151fe4d` | PASS |
| `WORK-0003` duplicate-attempt guard present; owner/mode prior values preserved; not claimed `PROMOTED` | PASS |
| Mission state: current run, prior run, prior truth note, prior control-plane commit all preserved; lineage `UNDECIDED` | PASS |
| `WAVE-0001..0009` recorded `PERMANENTLY_UNKNOWN` | PASS |
| Lineage claims **re-derived in this run**, not copied: merge-base, `origin/main` ahead count, absence of `.kilo/team/memory/` on `origin/main`, `9151fe4d` not an ancestor, exactly 10 registry SHAs origin/main-only | PASS |
| Exactly one evidence report at the required path with all 10 required sections, and no IMPLEMENT-only sections | PASS |
| No ledger contains a false-green status (`PROMOTED`, `MISSION_COMPLETE`, `productComplete`) | PASS |
| Write scope: every changed and untracked path inside `.kilo/team/memory/**` or this results directory | PASS |
| No protected path (`Backend/`, `web/`, `Assistant/`, `Docs/`, `Architecture/`, `.github/`, manifests, `.kilo/plans/`, `.kilo/evidence/`, `.kilo/team/*.json`, `COMMANDS/`) modified | PASS |

Repository commands used as evidence: `git log`, `git rev-list`, `git rev-parse`, `git merge-base`,
`git merge-base --is-ancestor`, `git for-each-ref`, `git cat-file -t`, `git show --name-only`,
`git ls-tree`, `git branch -r --contains`, `git status --porcelain`, `git ls-files --others`,
`grep -rIn`.

Derivation and verification scripts live **outside** the repository, per the write scope:
`/tmp/opencode/backfill_0003_run2.py`, `/tmp/opencode/verify_0003_run2.py`.

**Verification limits, stated honestly.** Ledger integrity, provenance, ID discipline and write-scope
compliance are verified. The *substantive correctness* of the Wave-10 findings registered here is not
re-verified by this lease — it is cited with branch provenance and the promotion state is recorded as
open. The canonical-lineage question is recorded, not resolved. Independent QC has not run.

# PROVENANCE

- `START_SHA = 6c9d4da5b04a1063e9fe616c2b1c4d9fd072397b`, verified equal to `git rev-parse HEAD` at
  lease start and equal to the tip of `origin/fix/autonomous-product-factory`.
- Branch: `opencode/team-work-0003-memory-backfill-37779956878`; run id `37779956878` read from the
  branch name.
- Prior unpromoted attempt of this same lease: `509ce84cc31d9ccfab1aae8a31d8d6bd17af1a8b`, branch
  `origin/opencode/team-work-0003-memory-backfill-37776552275`, run `37776552275`; read as evidence,
  independently re-verified, three of its numeric claims corrected.
- Prior unpromoted WORK-0004 attempt: `ba49094f6fe445deaec20e01d73b172c05935807`, branch
  `origin/opencode/team-work-0004-wave10-recovery-37776552275` — registered for traceability only;
  that lease's reconciliation is not this lease's work.
- Wave-10 `START_SHA = 04119244e326f498db21f81f0509dd8374e10cf5`, verified as the parent of all 11
  Wave-10 worker commits and as an ancestor of this branch.
- Divergent lineage: merge base `99542164a06f15aa4072a52b9debcf75125a358a` (2026-08-28);
  `origin/main` tip `0bfe3eae515f58168b230d28895676353e3ba889`; this lineage tip `6c9d4da5`.
- V2 control-plane range `3ebeaa1d1e19eecad98201ff56666f1db778de06..6c9d4da5` (37 commits, linear).
- Every derived set is produced at run time from `git` output — never hand-typed — so provenance
  cannot drift from the repository.
- All new records carry `recorded_by = work-0003-memory-backfill-37779956878`; commit records carry
  exact SHA, subject, ISO date, lineage, derivation command and, for the 13 pre-existing records, a
  machine-derived `lineage_verification`.
- **Provenance defect, not repaired:** the 11 Wave-10 result artifacts were read from remote worker
  branches because they are absent from this branch. Their content is therefore branch-scoped
  evidence, not a target-branch fact, and every such record says so.
- No secret, personal or confidential customer financial data was read, written or transmitted.
- `WORKER_STATE = ADVANCED`, `LEASE_STATE = EXECUTED_AWAITING_QC`, one coherent commit, no promotion,
  no human action required for this Micro-Stage.