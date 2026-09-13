# Kilo Governed Operator Decision

**Status:** APPROVED / GOVERNED
**Architecture baseline:** Architecture Freeze V4
**Decision type:** Construction-tool/operator policy

## Decision

Kilo Code is an approved local execution/operator layer of the HooshyarOS construction fabric. Kilo is elevated from an optional convenience adapter to the **primary local implementation and repair operator when available and healthy**, while Python remains the canonical repository-native orchestration, analysis and verification layer and the Assistant remains the architecture/governance authority.

This decision changes operator strength, not architectural ownership.

## Kilo responsibilities

When selected by the autonomous construction planner, Kilo may execute governed repository operations for:

- implementation of exactly one approved construction knot;
- focused test execution;
- integration-test execution requested by the plan;
- root-cause investigation from captured evidence;
- bounded repair of the current failed knot;
- standardization/refactoring required by the accepted knot contract;
- evidence collection and repository-state inspection;
- local build/package operations required by the stage;
- Git status/diff inspection and other non-destructive repository operations;
- finalization of a verified stage when the orchestrator explicitly authorizes it.

Kilo does not independently select product scope, redefine architecture, change frozen engine ownership, weaken tests, bypass governance, or declare commercial completion.

## Required control model

The authoritative flow remains:

`READ → AUDIT → SELECT KNOT → PLAN → DEPENDENCY CHECK → KILO EXECUTION → STATIC VALIDATION → FOCUSED TEST → INTEGRATION → APPLICATION/ACCEPTANCE → EVIDENCE AUDIT → CHECKPOINT → COMMIT/PUSH → RE-PLAN`

For failure:

`DETECT → DIAGNOSE → KILO REPAIR → RE-TEST → RE-VERIFY`

If Kilo cannot safely complete the stage within the bounded repair/execution budget, the orchestrator must preserve evidence and fall back to Python or enter `BLOCKED`. Blind retries are prohibited.

## Provider and model boundary

Kilo is an execution mechanism, not a product runtime dependency.

The default construction model configuration is the repository-approved free Kilo model path:

- `kilo-auto/free`
- `kilo/kilo-auto/free` for the explicit Hooshyar construction/repair agents

A local user/model configuration must not silently replace the governed construction model with an unavailable paid model. The adapter must enforce the approved default unless an explicit governed configuration overrides it.

## Artifact boundary

Kilo may modify only the paths declared by the current stage/capability contract and directly required generated evidence. Unexpected repository changes are a hard failure and must enter repair/revert handling.

## Human boundary

The human owner remains responsible only for product intent, architecture/governance decisions, external credentials/permissions, consequential external operations and unresolved BLOCKED states. Routine Kilo execution, repair, testing and stage advancement must remain autonomous.

## Completion rule

Kilo output is never completion evidence by itself. A Kilo-generated change is accepted only after the same focused, integration, application and architecture evidence required for any other operator passes.

## Rationale

The project already contains a governed Kilo execution adapter and a stage-bounded construction model. Strengthening the role removes unnecessary human mechanical intervention while preserving Architecture Freeze V4, evidence discipline, recovery boundaries and operator independence.
