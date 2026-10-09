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
BACKFILL_ATTEMPT = 3 of WORK-0003 (runs 37776552275, 37779956878, 37788700120); latest result integrated via cherry-pick in run 37788700120; historical attempt states preserved
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
- Seven worker-result branches across WORK-0003/0004/0005 are retained as provenance. In run 37788700120,
  WORK-0003 and WORK-0005 result contents were integrated after aggregate QC passed (2 successful
  reports, 1 failed worker). The latest valid WORK-0004 report remains unpromoted and unadjudicated;
  its later attempt failed before producing a result. BLOCKER-0005 remains OPEN because the wave did not
  close and synthesis failed. Team V2 acceptance is NOT claimed.
- An unpromoted WORK-0004 attempt reattributes the Wave 10 integration failure to a missing git
  committer identity. That is recorded as a pending correction (DECISION-0012), not applied.


## Reconciled observed execution (2026-10-09)

- WAVE-0011 run 37788700120: aggregate QC PASS; two result contents integrated; WORK-0004 failed during OpenCode installation; synthesis failed with `MODELS[3]: unbound variable`.
- Do not dispatch WORK-0003 or WORK-0005 again. WORK-0004's latest valid report remains unpromoted/unadjudicated and its Wave 10 root-cause attribution remains pending under DECISION-0012.
- F1/F2 repair evidence belongs to origin/main; it does not choose canonical lineage. BLOCKER-0004 and BLOCKER-0005 stay OPEN; Gate A remains ARMED.
- Green aggregate QC does not mean WAVE-0011 acceptance. No product work or workflow reactivation is authorized by these memory changes.
