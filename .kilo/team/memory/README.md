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

## Backfill state

BACKFILL_STATUS = TEAM_DOMAIN_BACKFILLED / PRODUCT_ERA_UNKNOWN
BACKFILL_SCOPE = team organizational ledgers under .kilo/team/memory/ only
BACKFILL_RULE = evidence-first; no guessing
BACKFILL_SOURCE = git object database reachable from this branch and its remotes
BACKFILLED_BY = work-0003-memory-backfill-37779956878
BACKFILL_LEDGER_RECORDS = 8 ledgers; see backfill_state in each ledger
NEXT_BACKFILL_WORK = NONE_IN_TEAM_DOMAIN

## What is NOT covered by this backfill

Stated explicitly so that no reader mistakes coverage for completeness:

- The 11 Wave 10 audit reports exist only on unpromoted worker branches (BLOCKER-0003). They are
  registered as branch-scoped evidence, not as facts about this branch.
- `WAVE-0001`..`WAVE-0009` have no repository evidence and stay permanently unknown.
- The pre-V2 product-era work, its 1541-commit history and the 60 `.kilo/evidence/` artifacts are
  NOT reconstructed.
- `REPORT-####` and `RECOVERY-####` are declared stable IDs with no canonical ledger; they stay
  unbacked rather than gaining an invented ninth ledger.
- The canonical target lineage is UNDECIDED (BLOCKER-0004). Every memory claim is scoped to this
  branch lineage until a governed decision is made.
