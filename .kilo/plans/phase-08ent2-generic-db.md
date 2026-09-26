# Phase 08-ENT.2 — Generic Database Acquisition Contract — Checkpoint

## Stage
- **Stage ID:** 08-ENT.2
- **Title:** Generic Database Acquisition Contract
- **Phase:** 08 — Universal Data Acquisition
- **Parent Stage:** 08
- **Owner:** Backend/HBOS/Product/FinancialDataIngestionAdapter.ts
- **Status:** COMPLETE
- **Timestamp:** 2026-09-03T19:55:00Z
- **Commit SHA:** 8624621bf5763fae1a98efdac1d76334ebe76d5d

## Implementation
- New module: `Backend/HBOS/Product/GenericDbConnector.ts`
  - `DbDriver` / `DbConnection` interfaces (no real DB driver bundled)
  - `GenericDbConnector` with connect/close/runQuery
  - `validateReadOnlyQuery(sql)`:
    - Rejects non-SELECT/WITH queries
    - Rejects INSERT/UPDATE/DELETE/MERGE/UPSERT/REPLACE/DDL/transaction-control keywords
    - Rejects multi-statement queries
    - Strips comments and string literals so keywords inside them are ignored
  - Row cap (default 100_000) prevents unbounded pulls
  - `DB_ERROR_CODES = { CONNECTION_REQUIRED, QUERY_REQUIRED, WRITE_REJECTED, QUERY_INVALID, DRIVER_REQUIRED, ROW_MAPPING_FAILED }`
- Canonical owner NOT modified.

## Inputs
- connectionString, driver, mapRow, maxRows

## Outputs
- DbFetchResult { rows, rejected: false }

## Verification Metric
- `npm test -- --testPathPattern="GenericDbConnector"` — 11/11 PASS
- baseline 61 preserved

## Resource Policy
- maxRows cap (default 100_000).
- No real DB driver; tests inject a stub.

## Security Controls
- Read-only enforcement via keyword + multi-statement filter.
- Defense-in-depth: the canonical driver is still responsible for the
  final authorization, but the connector refuses to forward a write
  attempt regardless of the driver.
- `null` row-mapping is skipped to prevent untyped data from leaking
  into the canonical model.

## Known Limitations
- No real driver; tenant must supply a concrete implementation.

## Resume Condition
- N/A — stage complete.

## Blocked By
- None.

## Next
- 08-GOV.1 — Credential Isolation.