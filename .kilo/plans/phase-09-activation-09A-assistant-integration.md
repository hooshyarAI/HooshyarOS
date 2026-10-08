# Phase 09-activation — GAP 1: AssistantEngine → Orchestrated Integration

## Stage ID
09-ACT-1

## Goal
Wire the canonical `AssistantEngine` into the Phase 09 `OrchestratedDecisionIntelligenceService` so that the Assistant path actually reaches deterministic financial/risk/decision intelligence rather than terminating in legacy decision heuristics.

## Owner
`AssistantEngine` (with `OrchestratedDecisionIntelligenceService` as delegated math owner)

## Preconditions
- Phase 09 implementation commits present (HEAD `05d4e2f7`).
- `OrchestratedDecisionIntelligenceService` exists at `Backend/HBOS/Product/`.
- `AssistantEngine` exists at `Backend/HBOS/Engines/`.

## Dependencies
- None new. Reuses existing Engines and the orchestrated service.

## Scope
1. Add `OrchestratedDecisionIntelligenceService` as an optional constructor dependency to `AssistantEngine`.
2. Add a public method `analyzeAcquisitionOpportunity(problem, orchestratedInput, context?)` that:
   - Delegates all deterministic math to the orchestrated service.
   - Uses the existing `intelligenceEngine.reason` for interpretation only.
   - Returns `{ response, orchestrated }` where `response` is the canonical `AssistantResponse`.
3. Add a focused integration test file.

## Verification Metric
- 7/7 new tests pass.
- 339 prior baseline tests still pass.
- AssistantEngine no longer duplicates math; all numbers in the explanation come from the orchestrated service.
- No new Engine created.
- No new dependency.
- Tenant isolation preserved (tenantId propagated through `OrchestratedInput.tenantId`).

## Test Result
```
Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
```

## Evidence
- `Backend/HBOS/Engines/AssistantEngine.ts` now imports `OrchestratedDecisionIntelligenceService` and `OrchestratedInput`/`OrchestratedResult`.
- The new `analyzeAcquisitionOpportunity` method:
  - Validates inputs (throws on missing tenant or problem).
  - Calls `this.orchestrated.orchestrate(input)`.
  - Composes an `AssistantResponse` with a deterministic explanation and `TruthfulConfidence` (calculated if READY, unavailable if BLOCKED).
  - Does not invoke any NPV/IRR/WACC math directly.

## Remaining Limitations
- The orchestrated service is a singleton-style class; the Assistant constructs a default if no injection. This is acceptable for the current product boundary.
- The `Project` entity used in the `AssistantResponse` is a synthetic shim because orchestrated results do not originate from a Project. Documented in code comments.

## Implementation SHA
(pending commit)

## Checkpoint SHA
(pending commit)

## Remote SHA
(pending push)

## Status
COMPLETE
