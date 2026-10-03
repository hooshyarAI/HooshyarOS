# Phase 08-GOV.2 — Connector Lifecycle — Checkpoint

## Stage
- **Stage ID:** 08-GOV.2
- **Title:** Connector Lifecycle
- **Phase:** 08 — Universal Data Acquisition
- **Parent Stage:** 08
- **Owner:** Backend/HBOS/Product/FinancialDataIngestionAdapter.ts
- **Status:** COMPLETE
- **Timestamp:** 2026-09-03T20:08:00Z
- **Commit SHA:** 7ded2d3e4ece48dc81646c137dd0fa0a297ce535

## Implementation
- New module: `Backend/HBOS/Product/ConnectorRegistry.ts`
  - State machine: `registered -> tested -> enabled -> disabled -> retired`
  - Allowed transitions encoded in a typed table; invalid ones throw
  - Audit trail per connector: { connectorId, tenantId, fromState, toState, at, by, reason? }
  - Global audit log aggregates all entries
  - `retired` is terminal
  - Injectable `now()` clock for deterministic tests
  - `CONNECTOR_LIFECYCLE_ERROR_CODES = { TENANT_REQUIRED, CONNECTOR_REQUIRED, STATE_REQUIRED, INVALID_TRANSITION, UNKNOWN_CONNECTOR, AUDIT_REQUIRED }`
- Canonical owner NOT modified.

## Inputs
- register { tenantId, connectorId, by }
- transition { tenantId, connectorId, toState, by, reason?, now? }

## Outputs
- ConnectorState on transition; ReadonlyArray<ConnectorAuditEntry> for getAudit/getGlobalAudit

## Verification Metric
- `npm test -- --testPathPattern="ConnectorRegistry"` — 11/11 PASS
- baseline 61 preserved

## Resource Policy
- In-memory; no durability required for this stage.

## Security Controls
- Every transition requires a non-empty `by` actor.
- Tenant-scoped key.
- Invalid transitions throw, never silently fail.
- Re-registration of an existing connector is rejected.

## Known Limitations
- In-memory only; durable audit replay requires the canonical
  persistence boundary in a future stage.

## Resume Condition
- N/A — stage complete.

## Blocked By
- None.

## Next
- 08-GOV.3 — Tenant-Scoped Sync State.