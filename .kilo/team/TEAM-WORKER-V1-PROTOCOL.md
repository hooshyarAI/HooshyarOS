# HooshyarOS Autonomous Team Worker V1 Protocol

**Status:** APPROVED / READY-MANUAL
**Mode:** AUDIT_PARALLEL
**Initial pool:** 12 workers
**Scale targets:** 12 -> 25 -> 50 -> 100

## Purpose

Convert the single remote construction operator into an isolated worker pool without changing Architecture Freeze V4/V4.1 or creating parallel product engines.

The team is a construction mechanism only. It does not become a new product engine.

## Team topology

ORCHESTRATOR / CONTROL PLANE
        |
        +--> Worker 01 .. Worker 12 (isolated)
        |
        +--> INTEGRATOR / QC
        |
        +--> continuation / stop notification

Each worker:
READ -> AUDIT/IMPLEMENT ASSIGNED MICRO-STAGE -> TEST -> EVIDENCE -> ONE COMMIT

Workers never share a working tree.

## V1 rule

V1 begins in **AUDIT_PARALLEL** mode because the active master mission currently requires Post-Recovery / Architecture + Audit Reconciliation and explicitly forbids product implementation during that first stage.

Each worker must write only under:

`.kilo/team/results/<worker-id>/`

This keeps the first parallel wave collision-free and produces independently attributable evidence.

## Work lease

Every worker receives a lease containing:

- worker_id
- role
- focus
- owning canonical engine
- START_SHA
- allowed write scope
- mission identifier
- run identifier
- completion state

A worker must not select a different role or grab another worker's lease.

## Isolation

Every worker runs from the same immutable START_SHA on a separate branch:

`opencode/team-<worker-id>-<run-id>`

No worker may:
- edit another worker's branch;
- write to a shared worktree;
- modify protected control-plane paths;
- force-push;
- rewrite history;
- weaken tests;
- claim completion from self-report alone.

## Model policy

Every worker independently uses the adaptive-free model selector already approved for HooshyarOS.

The worker may fall back only across eligible zero-cost candidates.

No paid automatic fallback.

Model selection remains a mechanism, never an architecture or product authority.

## Integration

Successful worker commits are collected as evidence-bearing worker branches.

The Integrator:
1. checks each worker result;
2. verifies one coherent worker commit;
3. verifies allowed-path compliance;
4. verifies worker branch ancestry from START_SHA;
5. performs deterministic integration;
6. rejects conflicts rather than silently choosing one side;
7. runs team-level verification;
8. records the integrated state.

For V1 audit-only work, worker result paths are disjoint, so integration should be mechanically conflict-free.

## Scale law

The team is capacity-controlled, not count-driven.

Initial:
`max_parallel = 12`

Scale only after evidence confirms:
- runner availability;
- provider/model availability;
- integration capacity;
- no increase in false-green/false-positive results;
- acceptable failure/recovery behavior;
- acceptable cost (must remain zero-cost model policy);
- measurable throughput improvement.

Target pool sizes:
12 -> 25 -> 50 -> 100.

100 is a ceiling, not a required operating point.

## Implementation waves

After V1 audit and synthesis prove the dependency graph, future implementation waves may assign independent product Micro-Stages to separate workers.

For implementation waves:
- each worker receives an explicit write scope;
- overlapping file ownership is rejected unless a governed integration stage owns the overlap;
- workers do not directly promote to the target branch;
- the Integrator/QC stage is the only promotion authority for the wave.

## Dependency-aware parallelism

Do not parallelize work merely because workers are available.

A Micro-Stage is parallel-eligible only when:
- its dependencies are satisfied;
- no protected boundary is touched;
- no write-scope collision exists;
- its verification contract is independently executable;
- the active mission permits work at that stage.

Dependent stages remain queued.

## Failure handling

A single worker failure must not invalidate independent workers.

Worker state:
- ADVANCED
- RECONCILED
- BLOCKED
- NO_SAFE_WORK
- BLOCKED_FREE_MODEL_UNAVAILABLE

The team continues safe independent work while preserving failed evidence.

A team run becomes BLOCKED when integration or a shared dependency is unresolved.

## QC

Implementation-agent self-report is never independent QC.

At least one separate QC/integration pass must verify:
- evidence exists;
- tests correspond to the changed capability;
- changed paths match the lease;
- no protected paths were touched;
- branch ancestry is correct;
- no false-green condition is present;
- result is reproducible.

## Completion

Team success means:
- all eligible worker leases completed or explicitly blocked;
- evidence persisted;
- integration verification passed;
- active mission state is updated;
- next eligible wave is identified;
- promotion is verified.

The team never substitutes worker count for product completion.

## Human interruption

Human action is required only for:
- external credentials;
- external approvals;
- production/legal/business decisions;
- unresolved governance/architecture contradictions.

Routine worker continuation must not ask for stage-by-stage human approval.

## Relationship to single-worker mode

The existing single-worker workflow remains the recovery fallback until Team Worker V1 has passed its first controlled wave.

Once V1 passes:
- Team Worker becomes the primary throughput path;
- Single Worker remains the low-capacity fallback/watchdog path.



## Dynamic wave planning

After a wave is synthesized, the Team Synthesizer must produce:

`.kilo/team/NEXT-WAVE-PLAN.json`

validated against:

`.kilo/team/NEXT-WAVE-PLAN.schema.json`

The next Team Wave must use `NEXT-WAVE-PLAN.json` when `wave_status = READY` and must not fall back to the initial 12 audit leases.

Each dynamic lease contains:
- id
- role
- focus
- owner
- mode = AUDIT | IMPLEMENT | REVIEW | VERIFY
- explicit write_scope

The Orchestrator may create up to 100 leases, but only independent dependency-ready leases are eligible for the current wave.

The plan must prevent:
- duplicate work already completed;
- overlapping uncontrolled writes;
- dependency violations;
- unauthorized protected-path changes;
- repeated audit loops.

When no safe next lease exists, the plan must say `COMPLETE` or `BLOCKED` with evidence rather than inventing work.
