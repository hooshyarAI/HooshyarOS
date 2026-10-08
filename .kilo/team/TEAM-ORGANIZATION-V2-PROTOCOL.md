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
