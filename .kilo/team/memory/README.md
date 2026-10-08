# HooshyarOS Team Organizational Memory V2

This directory is the persistent organizational memory for the autonomous construction team.

## Rules

- IDs are permanent and never recycled.
- Every active work item must be traceable to evidence, decisions, blockers/defects and commits where applicable.
- Unknown historical facts remain explicitly unknown.
- Stale evidence is not completion evidence.
- Failed evidence is preserved.
- The Memory & Editor role is the canonical deduplication and memory-integrity authority.
- The ledgers are process memory, not a new product engine.
- A dedup control that has never been promoted cannot gate a dispatcher that reads promoted state.

## Backfill state

BACKFILL_STATUS = TEAM_DOMAIN_BACKFILLED / PRODUCT_ERA_UNKNOWN
BACKFILL_SCOPE = team organizational ledgers under .kilo/team/memory/ only
BACKFILL_RULE = evidence-first; no guessing
BACKFILL_SOURCE = git object database reachable from this branch and its remotes
BACKFILLED_BY = work-0003-memory-backfill-37788700120
BACKFILL_ATTEMPT = 3 of WORK-0003 (runs 37776552275, 37779956878, 37788700120); none promoted, none QC-adjudicated
BACKFILL_REUSE = prior unpromoted ledger content reused as evidence, then every material claim re-derived from live git
BACKFILL_LEDGER_RECORDS = 8 ledgers; 145 commit records, 23 evidence records
NEXT_BACKFILL_WORK = NONE_IN_TEAM_DOMAIN

## What is NOT covered by this backfill

Stated explicitly so that no reader mistakes coverage for completeness:

- The 11 Wave 10 audit reports exist only on unpromoted worker branches (BLOCKER-0003). They are
  registered as branch-scoped evidence, not as facts about this branch.
- `WAVE-0001`..`WAVE-0009` have no repository evidence and stay permanently unknown.
- The pre-V2 product-era work, its 1541-commit history and the 60 `.kilo/evidence/`
  artifacts are NOT reconstructed.
- `REPORT-####` and `RECOVERY-####` are declared stable IDs with no canonical ledger; they stay
  unbacked rather than gaining an invented ninth ledger.
- The canonical target lineage is UNDECIDED (BLOCKER-0004). Every memory claim is scoped to this
  branch lineage until a governed decision is made.
- 5 governed V2 worker results (WORK-0003, WORK-0004, WORK-0005) are stranded on unpromoted
  branches (BLOCKER-0005). Nothing in them is QC-adjudicated, promoted or accepted, including this
  backfill.
- An unpromoted WORK-0004 attempt reattributes the Wave 10 integration failure to a missing git
  committer identity. That is recorded as a pending correction (DECISION-0012), not applied.
