# WORK-0003 — Legacy Work and Evidence Backfill — EVIDENCE REPORT

```text
WORKER_ID      = work-0003-memory-backfill
WORK_ID        = WORK-0003
ROLE           = Memory & Editor
OWNER_ENGINE   = MEMORY_EDITOR
MODE           = AUDIT
FOCUS          = Backfill and reconcile organizational ledgers from repository evidence;
                 preserve unknowns and stale states; no product implementation
START_SHA      = 6c9d4da5b04a1063e9fe616c2b1c4d9fd072397b  (verified == git rev-parse HEAD)
RUN_ID         = 37788700120  (read from branch opencode/team-work-0003-memory-backfill-37788700120)
WRITE_SCOPE    = [.kilo/team/memory/**, .kilo/team/results/work-0003-memory-backfill/]
TEAM_ORG       = V2
LEASE_STATE    = EXECUTED_AWAITING_QC
WORKER_STATE   = ADVANCED
```

# STATUS

`EXECUTED_AWAITING_QC` — the memory backfill Micro-Stage is complete and mechanically verified. No
product implementation was performed. Independent QC, integration and promotion are **not** performed
by this lease and are **not** claimed.

The decisive fact discovered before writing anything: **this exact lease had already been executed
twice and promoted neither time** (`509ce84c` / run `37776552275`, `3b8b97d0` / run `37779956878`,
identical `START_SHA`). This is the third dispatch. Neither prior attempt is `DONE`, `VERIFIED`,
`ACCEPTED`, `SUPERSEDED`-as-invalidated or `DUPLICATE` in the ledger sense, so the V2 rule did not
bar this run — but the repetition itself was invisible to the dispatch gate, which is exactly the
failure mode the backfill exists to prevent. The measured root cause is recorded, not guessed:
**`BLOCKER-0005` — five governed V2 worker results are stranded on unpromoted branches, so no dedup
control, QC verdict or gate state can advance.**

Method was **reuse-and-verify, not regenerate**. The second attempt's ledger baseline was read from
the git object database, adopted only after every material claim was re-derived independently from
live `git` output in this run, and corrected where stale. Six of its claims were stale.

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

Explicitly not touched: `Backend/**`, `web/**`, `mobile/**`, `Assistant/**`, `Docs/**`,
`Architecture/**`, `.github/**`, package manifests, `.kilo/plans/**`, `.kilo/evidence/**`,
`.kilo/agents/**`, `.kilo/team/*.json`, `.kilo/team/COMMANDS/**`. Verified mechanically
(§ VERIFICATION_METHOD, `G12`). Architecture Freeze V4/V4.1 unmodified; no governance authority
modified; no test modified, weakened or deleted; no merge, rebase, branch move, force-push or
history rewrite.

# CURRENT_EVIDENCE

All facts below are **FACT**, re-derived in this run from live repository state, not carried over
from a prior attempt or from worker prose.

## Ledger state at START_SHA

| Ledger | Records | Defect observed |
|---|---|---|
| `work-registry.json` | 7 | `WORK-0003` had no record of its two prior executions; `WORK-0004`/`WORK-0005` had no record of their unpromoted attempts |
| `evidence-registry.json` | 5 | 11 Wave-10 audits unregistered; `source_present_at_start_sha` asserted `true` on two records whose paths are absent |
| `decision-registry.json` | 4 | the evidence-only backfill rule was applied in practice but never recorded |
| `defect-registry.json` | 1 | every defect found by later waves unregistered |
| `blocker-registry.json` | 2 | no record that any V2 wave worker result was ever promoted |
| `commit-registry.json` | 13 | 1 divergent-lineage commit + 4 unpromoted worker attempts unregistered |
| `wave-history.json` | 1 (`WAVE-0010`) | `WAVE-0011` in use but absent from `waves`; `next_id` collided; `WAVE-0001..0009` unknown |

## Independently re-verified lineage facts

```text
git rev-parse HEAD                          -> 6c9d4da5b04a1063e9fe616c2b1c4d9fd072397b   (== START_SHA)
git rev-parse origin/fix/autonomous-product-factory -> 6c9d4da5b04a1063e9fe616c2b1c4d9fd072397b
git rev-parse origin/main                   -> d90d8e115c49b1e6d50e621d6066bfa191a01a49
git merge-base HEAD origin/main             -> 99542164a06f15aa4072a52b9debcf75125a358a  (2026-08-28)
git rev-list --count HEAD..origin/main      -> 81
git rev-list --count origin/main..HEAD      -> 662
git rev-list --count 3ebeaa1d~1..HEAD       -> 37    (V2 control-plane chain, linear)
git rev-list --count HEAD                   -> 1541
git ls-tree -r --name-only origin/main -- .kilo/team/memory   -> (empty)
git merge-base --is-ancestor 9151fe4d HEAD  -> non-zero (NOT an ancestor)
git log 9151fe4d..origin/main               -> 14 team-control commits
git for-each-ref refs/remotes/origin/opencode/team-*-37743827267   -> 11 Wave-10 branches
git for-each-ref refs/remotes/origin/opencode/team-work-*           -> 5 unpromoted V2 results
10 of 13 pre-existing commit-registry SHAs resolve only on origin/main
0 Wave-10 result paths exist in this branch's tree
0 result paths of the 5 unpromoted V2 worker attempts exist in this branch's tree
```

## Six corrections applied to the reused baseline

| # | Claim in run `37779956878` | Re-derived here | Mechanism |
|---|---|---|---|
| 1 | `origin/main` tip `0bfe3eae…` | `d90d8e11…` | `git rev-parse origin/main` |
| 2 | `origin/main` ahead = 80 | 81 | `git rev-list --count HEAD..origin/main` |
| 3 | 3 refs contain START_SHA | 6 | `git branch -r --contains` |
| 4 | 13 newer team-control commits on `origin/main` | 14 | `git log 9151fe4d..origin/main` |
| 5 | WORK-0005 "has no branch at all" | branch `…-work-0005-next-capability-37779956878` exists at `7fe96e2a` | `git for-each-ref` |
| 6 | `EVIDENCE-0003/0004` `source_present_at_start_sha = true` | `false` | `git cat-file -e HEAD:<path>` |

Correction 6 is a **false positive removed**, never an upgrade: the original claim is retained as
`*_previous_claim` and both records' `status` values are untouched (`DEFECT-0007`).

## Ledger state after this lease

| Ledger | Records | `next_id` |
|---|---|---|
| `work-registry.json` | 7 | `WORK-0008` |
| `evidence-registry.json` | 23 | `EVIDENCE-0024` |
| `decision-registry.json` | 13 | `DECISION-0014` |
| `defect-registry.json` | 8 | `DEFECT-0009` |
| `blocker-registry.json` | 5 | `BLOCKER-0006` |
| `commit-registry.json` | 145 | `COMMIT-0146` |
| `wave-history.json` | 2 (`WAVE-0010`, `WAVE-0011`) + 9 reserved-unknown | `WAVE-0012` |

145 commit records; every 40-character SHA machine-verified to resolve to a real commit.

# FINDINGS

### F1 — P0 — no governed V2 worker result has ever been promoted, and that is why this lease ran a third time

**FACT.** Five governed worker results exist across three leases of `WAVE-0011`, all from the same
`START_SHA`, none promoted, none QC-adjudicated:

| Lease | Run | Commit | Branch |
|---|---|---|---|
| WORK-0003 | 37776552275 | `509ce84c` | `…-work-0003-memory-backfill-37776552275` |
| WORK-0003 | 37779956878 | `3b8b97d0` | `…-work-0003-memory-backfill-37779956878` |
| WORK-0004 | 37776552275 | `ba49094f` | `…-work-0004-wave10-recovery-37776552275` |
| WORK-0004 | 37779956878 | `305466cc` | `…-work-0004-wave10-recovery-37779956878` |
| WORK-0005 | 37779956878 | `7fe96e2a` | `…-work-0005-next-capability-37779956878` |

`git merge-base --is-ancestor` is non-zero for every one of them. `qc_adjudications_found = 0`,
`integrations_performed = 0`, `promotions_performed = 0`.

The causal chain is measured, not inferred: run `37779956878` installed a duplicate-lease guard
**inside its own unpromoted commit**, so the dispatcher — which reads promoted state — could not see
it, and dispatched the same lease a third time. *An anti-duplication control that is never promoted
cannot gate anything.* That rule is now written into `memory/README.md`.

**Recorded as:** `BLOCKER-0005` (P0, OPEN), `DEFECT-0008` (P1, OPEN), `EVIDENCE-0023`,
`DECISION-0013`, `WORK-0003.fourth_dispatch_rule = REFUSE`.

### F2 — P0 — the Wave 10 integration failure root cause is contested, and the correction is not mine to apply

**FACT.** `BLOCKER-0001` is titled "Wave 10 integration target drift". The unpromoted `WORK-0004`
attempt `305466cc` reports `ROOT_CAUSE_OF_INTEGRATION_FAILURE = MISSING_GIT_COMMITTER_IDENTITY
(not target drift)`, `WAVE_10_RECOVERY = FAILED_BEFORE_DRIFT_EVALUATION`,
`WAVE_10_EVIDENCE_RECOVERABLE = YES`, and states that the `BLOCKER-0001` / `BLOCKER-0002` /
`WAVE-0010` memory corrections are owned by WORK-0003.

Independent corroboration on the divergent lineage: `origin/main` carries `d90d8e11`,
`fix(team): configure integration git identity before cherry-pick`.

**Not applied.** Root-cause attribution and promotion are INTEGRATOR/MISSION_DIRECTOR authority, and
the claiming lease is unpromoted and not QC-adjudicated. Applying it would be memory fabrication.
Recorded as `EVIDENCE-0020` (`OBSERVED_NOT_ADJUDICATED`), `DECISION-0012`,
`WORK-0003.pending_memory_correction_from_sibling_lease.applied = false`, with `COMMIT-0142`
cross-linked as corroboration. `BLOCKER-0001`'s title, status and evidence are byte-identical.

### F3 — P1 — this lease's own prior attempt asserted a false provenance claim

**FACT.** `3b8b97d0` set `source_present_at_start_sha = true` on `EVIDENCE-0003` and
`EVIDENCE-0004` while setting `source_reachability =
NOT_PRESENT_ON_THIS_BRANCH_RESOLVES_ON_UNPROMOTED_WAVE10_BRANCHES` on the same records. One field
was false. `git cat-file -e HEAD:<path>` proves both paths absent.

Corrected as a factual inconsistency, which is inside the MEMORY_EDITOR edit law; the original claim
is preserved and no status was changed. **`DEFECT-0007`, `EVIDENCE-0022`.** Recorded because a
thorough-looking prior attempt was not automatically trustworthy — reuse required verification.

### F4 — P1 — three contradictory run identifiers had become four, then five results on one wave

`mission-state` said `37760777088`, `wave-history.current` said `37759400053`, the executing branch
carried `37776552275`, then `37779956878`, now `37788700120`. All are preserved in
`run_id_history` / `run_attempts` with reasons and explicit states
(`SUPERSEDED_OR_UNKNOWN`, `QUEUED_NO_RUNNER_ALLOCATED`, `EXECUTED_UNPROMOTED`, `EXECUTING`). No job
outcome is guessed for any superseded run, and `37759400053` stays
`SUPERSEDED_OR_UNKNOWN` — no surviving evidence exists for it.

### F5 — P1 — five lease attempts on two leases where one result each was expected

`WORK-0004` ran twice and `WORK-0003` three times, all unpromoted, none QC-adjudicated. `WORK-0005`
ran once and claims a selected next capability (`product.impact-measurement-provenance`) while
explicitly reserving the decision to MISSION_DIRECTOR. All are registered with commit SHA, remote
ref, result paths, lease, run id and owner (`EVIDENCE-0020`, `EVIDENCE-0021`, `COMMIT-0143..0145`,
`WORK-0004.attempts`, `WORK-0005.attempts`). This lease **adopted none of them**.

### F6 — P1 — the target lineage divergence persists and `origin/main` has moved

`BLOCKER-0004` stands. `origin/main` is now 81 commits ahead (was 80 at the last observation) with
14 newer team-control commits (was 13), and still contains **no** `.kilo/team/memory/` path, while
this lineage is 662 commits ahead. The prior values are preserved under `refresh` /
`refreshed_by`. `canonical_lineage` remains **`UNDECIDED`** — naming it is MISSION_DIRECTOR authority
and this AUDIT lease may not merge, rebase, promote or decide it.

### F7 — P2 — `WORK-0003` ownership/mode and ID-collision defects carried over from the baseline

`work-registry` named `owner = PLANNER`, `mode = RECONCILIATION` against a lease naming
`owner = MEMORY_EDITOR`, `mode = AUDIT`; `work-registry.next_id` collided with an existing
`WORK-0007`, as did `wave-history.next_id` with `WAVE-0011`. All remain repaired with prior values
retained (`DEFECT-0003`, `DEFECT-0004`, `previous_owner`, `previous_mode`), and every `next_id` is
now derived from the highest used ID.

### F8 — P2 — two ID namespaces are declared but unbacked

`TEAM-ORGANIZATION-V2.json.stable_ids` declares `REPORT-####` and `RECOVERY-####`; the protocol
enumerates exactly eight ledgers and neither namespace has one. **No ninth ledger was invented** —
that would be the parallel governance hierarchy V2 forbids (`DECISION-0006`).

### F9 — P2 — self-reported defect of this lease, preserved rather than hidden

The first implementation of this run resolved path existence with
`git cat-file -e HEAD:<path>^{commit}`. The `^{commit}` peel only resolves commits, so every
Markdown citation — including `.kilo/plans/f6-roa-roe-average-balance-checkpoint-2026-10-06.md` and
`work-0006/…/PRE-GATE-BASELINE.md` — was falsely reported absent. The bug would have written four
false provenance claims into permanent memory. It was found by re-deriving a claim that should not
have changed, fixed at source, and the ledgers regenerated. Recorded here because the mode contract
forbids hiding it.

# DEPENDENCIES

- `WORK-0002` (Team Organization V2 Operationalization) — satisfied; its eight ledgers are the substrate.
- `TEAM-ORGANIZATION-V2-PROTOCOL.md` — the canonical ledger set is exactly the eight files above.
- `.kilo/team/NEXT-WAVE-PLAN.json` — source of this lease; `created_from_sha =
  e564682ad02df31adc458995d4232128c7fa0fd3`, an ancestor of this branch.
- `BLOCKER-0001` → `BLOCKER-0003` → direct cause of the unpromoted Wave-10 evidence.
- `BLOCKER-0004` (P0) — makes every memory claim lineage-ambiguous until a governed lineage decision.
- `BLOCKER-0005` (P0, new) — blocks QC, promotion, Gate A and any effective dedup control.
- `WORK-0003.execution_attempts` → `509ce84c` and `3b8b97d0`, reused as evidence after
  independent re-verification.
- **No code, workflow or manifest consumes these ledgers.** Only path-string references exist
  (`TEAM-WORKER-V1.json`, `TEAM-ORGANIZATION-V2.json`); `.github/workflows/**` never reads them.
  Additive JSON changes therefore carry no runtime coupling risk.

# RISKS

| # | Risk | Severity | Mitigation applied |
|---|---|---|---|
| R1 | This memory is read as authoritative for `origin/main` | P0 | `target_lineage.canonical_lineage = UNDECIDED`, `BLOCKER-0004`, truth note and `README.md` all scope claims to this lineage |
| R2 | A fourth blind re-run of this lease | P0 | three `execution_attempts`, `EVIDENCE-0023`, `DECISION-0013`, `WORK-0003.fourth_dispatch_rule = REFUSE` |
| R3 | The prior attempt is trusted because it looks thorough | P0 | adopted only after re-derivation; six claims corrected; one of its own claims found false |
| R4 | A pending root-cause correction is read as accepted | P0 | `BLOCKER-0001` unchanged; correction recorded with `applied = false` and `OBSERVED_NOT_ADJUDICATED` |
| R5 | Wave-10 audits are re-run because their reports look missing | P1 | all 11 registered with branch provenance; `BLOCKER-0003` permits citation change, not re-audit |
| A queued or unpromoted run is misread as executed, failed or accepted | P1 | every run carries an explicit state; `completion_not_claimed = true` on `WAVE-0011` |
| R7 | Repairing memory makes a failure look successful | P0 | verifier asserts pre-existing statuses unchanged (§ VERIFICATION_METHOD, `G4`) |
| R8 | This lease becomes the de-facto lineage decision or root-cause verdict | P0 | `canonical_lineage: UNDECIDED`; `DECISION-0008`/`0012` forbid both from this lease |
| R9 | Backfill over-reaches into product work | — | write scope asserted mechanically per changed path (`G12`) |

# OVERLAPS

- **SELF-OVERLAP, disclosed not hidden.** This lease ran third. The two prior attempts are registered
  with commits, runs, QC state (`NOT_PERFORMED`) and promotion state (`false`). Recorded as
  `EVIDENCE-0019`, `EVIDENCE-0023`, `DEFECT-0008`, `DECISION-0013`.
- **WORK-0004 (INTEGRATOR)** — owns promotion and the Wave-10 root cause. This lease recorded both
  unpromoted attempts and opened `BLOCKER-0005`; it promoted nothing and re-adjudicated no Wave-10
  finding.
- **WORK-0005 (PLANNER)** — its capability selection is registered (`EVIDENCE-0021`) and not adopted;
  selection stays reserved to MISSION_DIRECTOR.
- **WORK-0006 (MISSION_DIRECTOR)** — Gate A consumes `MEMORY_ACCURACY`, previously `NOT_MEASURED`.
  `PRE-GATE-BASELINE.md` is the only team-results artifact on this branch; it was not modified and
  **no gate verdict is claimed**.
- **WORK-0001** — `DEFECT-0002`'s `fix_work` is a governed lineage decision; reconciliation is
  outside this lease.
- **CONTRADICTIONS recorded, not merged.** `BLOCKER-0001` (Wave-10 drift) and `BLOCKER-0004`
  (lineage divergence) are linked via `corroborates`, not collapsed. `BLOCKER-0003` (Wave-10
  artifacts) and `BLOCKER-0005` (V2 wave artifacts) are explicitly marked distinct: same symptom,
  different wave and cause.
- **NOT OVERLAPPED, deliberately unmodified.** `NEXT-WAVE-PLAN.json`,
  `TEAM-ORGANIZATION-V2-PROTOCOL.md`, `TEAM-ORGANIZATION-V2.json`, the mission plan and
  `COMMANDS/POST-TEAM-V2-PERFORMANCE-AUDIT-EDIT-REPAIR.md` all carry current-state claims this
  backfill now contradicts (for example `wave_status = READY` while five results are stranded). They
  are outside `WRITE_SCOPE` and were **not** modified. Known residual inconsistency for their owner.

# RECOMMENDED_NEXT_MICRO_STAGE

**Governed promotion and independent QC of the `WAVE-0011` worker results, owned by `INTEGRATOR`,
starting with `WORK-0004` Wave-10 recovery evidence — then `WORK-0003` memory, then `WORK-0005`.
In parallel, a MISSION_DIRECTOR decision on the canonical target lineage (`BLOCKER-0004`).**

Rationale in strict priority order:

1. `BLOCKER-0005` (P0). Five results are stranded. Until QC adjudication exists, no dedup control,
   no Gate A input and no accepted work state can exist — and this lease will be dispatched a
   fourth time. This is the only finding that actively generates new waste.
2. `BLOCKER-0004` / `DEFECT-0002` (P0). `origin/main` has independently advanced its queue and
   runner governance; every memory claim stays lineage-scoped until this is decided.
3. Only then `WORK-0006` Gate A adjudication (`TEAM_V2_ACCEPTED` / `…_WITH_CONTROLLED_GAPS` /
   `TEAM_V2_BLOCKED`), which must consume real `WAVE-0011` evidence.

Not recommended and not started: any product implementation. `WORK-0007` stays gated by `WORK-0006`,
and `DECISION-0004` still forbids restarting accepted F1/F6/CCC/UX work without regression or
invalidation evidence.

# VERIFICATION_METHOD

Proportional verification. Product behaviour was not tested because this lease changed no product
code and `MODE = AUDIT` forbids product implementation; ledger integrity, provenance, ID discipline
and write-scope compliance were verified mechanically instead. Worker prose was never used as a
source of completion.

```text
python3 /tmp/opencode/verify_0003_run3.py     -> exit 0
```

**Result: PASS — 148 assertions, 0 failures.**

| Assertion group | Covers |
|---|---|
| `G1` | lease `START_SHA == HEAD`; current run recorded in the ledgers |
| `G2` | all 145 commit SHAs resolve to real commits (`git cat-file -e`) |
| `G3` | stable IDs unique and contiguous per ledger; every `next_id` free; unknown waves not reused |
| `G4` | pre-existing statuses preserved: `EVIDENCE-0001..0005`, `DEFECT-0001`, `BLOCKER-0001/0002` (incl. `runner_allocated: false` and all 17 queued run ids), `WAVE-0010` status/integration/synthesis, prior truth note, prior control-plane commit, prior run id |
| `G5` | every lineage claim **re-derived live**: `origin/main` tip, ahead counts both ways, merge base, absence of memory on `origin/main`, `9151fe4d` not an ancestor, refs containing START_SHA, 14 newer team commits, `UNDECIDED`, `origin/fix/autonomous-product-factory` unmoved |
| `G6` | all 13 pre-existing commit records re-verified field-by-field against live git |
| `G7` | every `source_present_at_start_sha` claim is true against the live tree, and the superseded claim is preserved |
| `G8` | all 5 unpromoted worker results registered, none an ancestor, QC claims zero |
| `G9` | three attempts visible, none claims promotion or QC, fourth-dispatch rule present, `WAVE-0011.completion_not_claimed` |
| `G10` | no false-green token anywhere in the ledgers; nothing claims promotion |
| `G11` | the pending root-cause correction is recorded and **not** applied |
| `G12` | every changed/untracked path inside write scope; no protected path touched |
| `G13` | exactly one report at the required path with all 10 required sections and no IMPLEMENT-only sections |
| `G14` | unknowns and stale states preserved: 9 unknown waves, Wave-10 absent branch unknown-cause, `PARTIALLY_SUPERSEDED` retained |
| `G15` | product era explicitly not backfilled; known limits enumerated |

Repository commands used as evidence: `git log`, `git rev-list`, `git rev-parse`, `git merge-base`,
`git merge-base --is-ancestor`, `git for-each-ref`, `git cat-file -e`, `git show --name-only`,
`git ls-tree`, `git branch -r --contains`, `git status --porcelain`.

Derivation and verification scripts live **outside** the repository, per the write scope:
`/tmp/opencode/backfill_0003_run3.py`, `/tmp/opencode/verify_0003_run3.py`.

**Verification limits, stated honestly.** Ledger integrity, provenance, ID discipline and
write-scope compliance are verified. The *substantive correctness* of the Wave-10 findings, of the
`WORK-0004` root-cause claim and of the `WORK-0005` capability selection is **not** re-verified here —
they are cited with branch provenance and left unadjudicated. The canonical-lineage question and the
root-cause question are recorded, not resolved. Independent QC has not run.

# PROVENANCE

- `START_SHA = 6c9d4da5b04a1063e9fe616c2b1c4d9fd072397b`, verified equal to `git rev-parse HEAD` at
  lease start and equal to the tip of `origin/fix/autonomous-product-factory`.
- Branch: `opencode/team-work-0003-memory-backfill-37788700120`; run id `37788700120` read from the
  branch name.
- Prior attempts of this same lease, read as evidence from the git object database and independently
  re-verified: `509ce84cc31d9ccfab1aae8a31d8d6bd17af1a8b` (run `37776552275`) and
  `3b8b97d0660b251d29c56d60753ffcbcfa01febe` — recorded in `COMMIT-0143` and
  `WORK-0003.execution_attempts` with their remote refs. Neither is an ancestor of this branch;
  neither is QC-adjudicated; neither is `DONE`.
- Sibling unpromoted attempts registered for traceability only, each with `owner_of_reconciliation`:
  `ba49094f…` (WORK-0004, run 37776552275), `305466cc…` (WORK-0004, run 37779956878),
  `7fe96e2a…` (WORK-0005, run 37779956878).
- Wave-10 `START_SHA = 04119244e326f498db21f81f0509dd8374e10cf5`, the parent of all 11 Wave-10
  worker commits and an ancestor of this branch.
- Divergent lineage: merge base `99542164a06f15aa4072a52b9debcf75125a358a` (2026-08-28);
  `origin/main` tip `d90d8e115c49b1e6d50e621d6066bfa191a01a49`; this lineage tip `6c9d4da5`.
- V2 control-plane range `3ebeaa1d~1..6c9d4da5b04a1063e9fe616c2b1c4d9fd072397b` (37 commits, linear).
- Every derived set is produced at run time from `git` output — never hand-typed — so provenance
  cannot drift from the repository.
- All records carry `recorded_by = work-0003-memory-backfill-37788700120`; reused records additionally
  carry `recorded_by_chain` / `reused_prior_attempt` so the earlier run remains attributable.
- **Provenance defect, not repaired:** the Wave-10 artifacts and the five unpromoted V2 results were
  read from remote worker branches because they are absent from this branch. Their content is
  branch-scoped evidence, not a target-branch fact, and every such record says so.
- No secret, personal or confidential customer financial data was read, written or transmitted.
- `WORKER_STATE = ADVANCED`, `LEASE_STATE = EXECUTED_AWAITING_QC`, one coherent commit, no promotion,
  no human action required for this Micro-Stage.