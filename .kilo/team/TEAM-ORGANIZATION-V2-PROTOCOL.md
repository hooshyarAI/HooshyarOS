# HooshyarOS Autonomous Construction Team Organization V2

**Status:** ACTIVE / PERMANENT PROCESS LAW  
**Organization:** PROGRAM-0001  
**Base execution substrate:** TEAM-WORKER-V1  
**Product-engine status:** NONE

## Purpose

V2 turns the existing worker pool into a professional, memory-governed construction organization without adding a product engine or changing Architecture Freeze V4/V4.1.

The team optimizes for correct throughput, evidence quality, no duplication, controlled recovery and durable organizational memory.

## Command hierarchy

```text
MISSION DIRECTOR
  -> PLANNER
  -> MEMORY & EDITOR
  -> ORCHESTRATOR
  -> SPECIALIST WORKERS
  -> INDEPENDENT QC
  -> INTEGRATOR
  -> MEMORY UPDATE
  -> REPORTING
  -> REPLAN
```

WATCHDOG observes the whole path independently.

## Capacity law

The V1 worker list is a specialist capability catalog, not a standing headcount. Under Team V2, active concurrency is derived only from the current `NEXT-WAVE-PLAN.json` READY leases. There is no legacy-pool fallback, no requirement to fill a fixed seat count, and no dispatch of work that is not READY, dependency-satisfied and non-duplicate. A missing or invalid V2 plan is a BLOCKED control state, not permission to start the legacy pool.

## Authority boundaries

**MISSION DIRECTOR** decides operational priority, capacity and conflict handling. It cannot redefine architecture, governance or completion evidence.

**PLANNER** owns Work Package decomposition, dependency DAG, readiness and explicit Work Leases. It cannot silently reopen completed work.

**MEMORY & EDITOR** is the single memory-integrity role. It consolidates facts, decisions, evidence, defects, blockers, commits and reports; deduplicates repeated work; marks stale/superseded records; and records evidence-backed corrections. It never turns a failed technical result into a success by editing wording.

**ORCHESTRATOR** dispatches only READY, non-duplicate, dependency-satisfied leases.

**SPECIALIST WORKERS** operate with one lease, one isolated branch, one write scope and one coherent verified commit.

**QC** is independent of worker self-report.

**INTEGRATOR** is the only team-level promotion authority and must reject uncontrolled target drift.

**WATCHDOG** preserves failures and alerts on stopped/stalled/failed/timed-out/blocked execution.

## Stable identity

IDs never get recycled or silently renamed.

```text
MISSION-#### PROGRAM-#### WAVE-#### WORK-####
DECISION-#### EVIDENCE-#### BLOCKER-#### DEFECT-####
COMMIT-#### REPORT-#### RECOVERY-####
```

Legacy work without an ID is backfilled from repository evidence. Unknown history is marked unknown; it is never guessed.

## Work registry contract

Minimum fields:

```text
ID, TITLE, PURPOSE, MODE, OWNER, DEPENDENCIES, BLOCKERS,
WRITE_SCOPE, TEST_SCOPE, EVIDENCE_REQUIRED, PRIORITY, RISK,
VALUE, READINESS, ESTIMATED_COMPLEXITY, STATUS
```

Dispatch rule:

```text
READY + NOT_DUPLICATE + DEPENDENCIES_SATISFIED
+ PROTECTED_BOUNDARY_CLEAR + VERIFICATION_EXECUTABLE
```

Before a lease is created, compare the candidate with memory as:

```text
EXISTS / DONE / VERIFIED / IN_PROGRESS / BLOCKED
/ SUPERSEDED / DUPLICATE / REGRESSION
```

A contradiction such as `EXISTS_IN_CODE` + `NOT_RUNTIME_INTEGRATED` becomes an explicit work item, never a hidden completion.

## Memory ledgers

The canonical repository memory is:

```text
.kilo/team/memory/mission-state.json
.kilo/team/memory/work-registry.json
.kilo/team/memory/evidence-registry.json
.kilo/team/memory/decision-registry.json
.kilo/team/memory/defect-registry.json
.kilo/team/memory/blocker-registry.json
.kilo/team/memory/commit-registry.json
.kilo/team/memory/wave-history.json
```

Every ledger change must preserve provenance and stable IDs.

## Evidence discipline

Evidence state is explicit:

```text
OBSERVED -> REPRODUCED -> VERIFIED -> INTEGRATION_VERIFIED -> ACCEPTED
```

or:

```text
STALE / SUPERSEDED / INVALID
```

A stale checkpoint cannot prove current product completion. Failed evidence is retained.

## Defects and blockers

Every defect follows:

```text
DEFECT -> FIX WORK -> VERIFICATION WORK -> CLOSURE
```

Every blocker records first observation, root cause, affected work, dependency, current state, last governed action and safe-unblock condition.

## Reports

The Editor/Reporting role produces:

**Executive report:** progress, completed, active, blocked, P0/P1, important discoveries, risks, next safe work and required human intervention.

**Technical report:** work IDs, evidence IDs, decisions, defects, blockers, commits, QC status, integration status, regressions, duplicates avoided and exact next stage.

No report may derive completion solely from worker prose.

## V2 migration rule

Existing V1 execution remains valid. V2 is an organizational overlay.

First required migration is to establish and backfill the ledgers from current repository evidence, then use the ledgers for all future planning. The migration itself is tracked as governed work; it does not authorize unrelated product changes.

## Current operating priority

```text
WORK-0001 = Post-Recovery / Architecture + Audit Reconciliation
WORK-0002 = Team Organization V2 Operationalization
WAVE-0010 = Recovery review / evidence preservation
```

Accepted F1/F6/CCC/UX work is not repeated without current regression or invalidation evidence.

## Admission Gate — mandatory before Dispatch

Planning and execution are separate authorities. The Planner/Synthesizer may create an undispatched lease in NEXT-WAVE-PLAN.json, but the Orchestrator may not dispatch a lease that has no corresponding WORK-#### record in work-registry.json.

The Team Manager must therefore run a single **Plan Admission Gate** before the immutable execution START_SHA is captured:

```text
PLAN READY
  -> validate stable WORK-#### identity
  -> validate next_id / non-recycled identity
  -> create missing Work Registry row atomically
  -> set status=READY, readiness=READY
  -> preserve lease owner/mode/scope/evidence requirements
  -> commit + push with target-head concurrency check
  -> recapture immutable START_SHA
  -> Orchestrator dispatch
```

A worker must never create its own Work Registry identity during execution. A missing registry row is an **admission problem**, not permission for a specialist to self-register.

Admission is idempotent: an already-admitted work item is reused only when its identity is still governed and its registry state remains eligible. Terminal, contradictory or malformed records cause BLOCKED; they are never silently overwritten.

## Throughput Law — speed without quality dilution

Team speed is optimized through **safe parallelism**, not fixed headcount:

```text
effective_parallelism =
  min(
    requested_capacity,
    number_of_dependency_ready_leases,
    number_of_non_overlapping_write_scopes
  )
```

Default requested capacity is 8. It is a ceiling, not a target. A wave with one ready lease runs one worker; a wave with six independent leases may run six concurrently; no empty seats are filled.

Parallel execution is permitted only when all leases are independently:
- READY and dependency-satisfied;
- non-duplicate with no unresolved prior attempts;
- protected-boundary clear;
- verification-executable;
- write-scope non-overlapping.

High-risk or tightly coupled work is serialized even when spare runner capacity exists. Evidence-heavy audits may parallelize; shared-memory reconciliation, architecture/control-plane changes, and promotion remain serialized authorities.

## Quality / Synergy Operating Loop

The team operates as a coordinated pipeline rather than independent agents producing disconnected reports:

```text
DIRECTOR
  ↓ priority / conflict / capacity
PLANNER
  ↓ dependency DAG + lease contracts
MEMORY & EDITOR
  ↓ identity / dedup / evidence context
MANAGER / ADMISSION
  ↓ atomic Work Registry admission
ORCHESTRATOR
  ↓ bounded parallel dispatch
SPECIALISTS
  ↓ isolated commits + result evidence
INDEPENDENT QC
  ↓ semantic + structural + runtime verification
INTEGRATOR
  ↓ atomic promotion / fail-closed
MEMORY UPDATE
  ↓ accepted facts / stale marking / metrics
REPORTING
  ↓ executive + technical status
REPLAN
```

Specialists do not negotiate scope with one another. Their synergy comes from shared evidence, explicit dependency contracts, common stable IDs, isolated write scopes and QC feedback—not from concurrent editing of the same files.

The team shall optimize these performance measures together:

`REAL_PRODUCT_ADVANCEMENT`, `CORRECT_THROUGHPUT`, `EVIDENCE_QUALITY`, `DUPLICATE_WORK_RATE`, `FALSE_GREEN_RATE`, `REGRESSION_RATE`, `RECOVERY_RATE`, `BLOCKED_WORK_AGE`, `INTEGRATION_CONFLICT_RATE`, `MEMORY_ACCURACY`, `QC_ACCEPTANCE_RATE`, `DECISION_REUSE`.

Speed is considered a failure when it increases duplicate work, false-green claims, integration conflicts, or rework.

## Wave Closure Law

A wave is not complete merely because worker jobs succeeded.

```text
WORKER SUCCESS
  ≠ QC ACCEPTANCE
  ≠ INTEGRATION
  ≠ PROMOTION
  ≠ MEMORY CLOSURE
```

The wave reaches COMPLETE only after the applicable chain has been independently verified. If any mandatory gate fails, the result is preserved and the next safe action is RECOVERY, RECONCILIATION, or BLOCKED—never blind rerun of the same lease.


## Production Hardening — 2026-10-08

The team is explicitly organized as a **generator/evaluator/integrator organization**, not a collection of independent chat agents.

### 1. Brain / hands / session separation

The reasoning agent, execution environment and durable evidence are separate concerns. A runner may fail, a model may time out, or an outer validator may reject a report; none of those events may erase a valid committed worker result.

A Worker commit must therefore be preserved on its isolated remote branch when a coherent clean commit exists, even when a later validation gate fails. The evidence artifact must also retain the commit identity, branch, start SHA, status, patch and execution metadata.

### 2. Generator → Evaluator separation

The Specialist Worker generates the change and its evidence report. QC is a separate job, session and decision authority.

QC must inspect:
- the worker report;
- the exact changed-file set;
- the actual worker patch/commit;
- the immutable start SHA;
- the relevant charter/governance/architecture constraints.

A report that is internally plausible but contradicted by the actual patch is FAIL.

### 3. Durable evidence before promotion

The mandatory evidence chain is:

`WORKER_COMMIT → REMOTE_BRANCH → WORKER_ENVELOPE → QC_ADJUDICATION → INTEGRATION → TARGET_PROMOTION → MEMORY_CLOSURE`

No stage may infer the next stage merely because the previous job returned green.

The QC decision must be persisted as a machine-readable artifact. Integrator promotion is blocked unless that persisted adjudication is PASS and explicitly records that the actual worker change was inspected.

### 4. Model-role separation

Model choice is role-specific:
- Planner/Synthesizer: strongest available reasoning configuration appropriate to planning.
- Specialist Worker: strongest qualified model for the leased implementation/audit mode.
- QC: prefer a different qualified candidate from the Worker when more than one qualified model exists.
- Fallback is bounded and explicit; a model failure creates a preserved failure/recovery state rather than uncontrolled spawning or blind retries.

DeepSeek-style thinking/tool use is treated as a model capability, not as an execution authority: the harness remains responsible for tool execution, durable state and verification. Official DeepSeek guidance documents thinking with tool calls, Agent Skills, and the need to preserve reasoning context across tool-call turns.

### 5. Safe parallelism

Parallelism is created only by independently ready leases with non-overlapping write scopes. Shared memory reconciliation, architecture/control-plane edits, QC adjudication and promotion are serialized authorities.

The target is **maximum correct throughput**, not maximum worker count.

### 6. Recovery law

When a worker fails after producing a commit, the team preserves the remote branch and records the failure. It does not re-dispatch the same lease.

Recovery requires a new governed recovery/reconciliation decision that references the failed execution evidence. A second dispatch of the same unresolved lease is a governance failure.

### 7. Acceptance gate for continued investment

Before the team is allowed to expand to broad remaining product work, it must demonstrate one clean end-to-end governed wave:

`Admission → Reservation → Worker → Branch Preservation → Independent QC → Persisted QC Artifact → Deterministic Integration → Target Promotion → Memory Closure`

Any failure in this chain is a team-control defect until its root cause is repaired and one clean acceptance wave succeeds. Product expansion remains blocked until this gate passes.

