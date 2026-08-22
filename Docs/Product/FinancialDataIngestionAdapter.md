# FinancialDataIngestionAdapter

Canonical product capability: `product.financial-data-ingestion`.

Target engine: Financial Intelligence Engine

## Capability

Ingest and normalize repository-supported financial/accounting CSV data into a tenant-scoped canonical financial model while preserving source evidence and persistence evidence.

## Dependencies

- Knowledge Engine
- Financial Intelligence Engine
- SQLitePersistenceStore

## Construction boundary

- Implementation: `Backend/HBOS/Product/FinancialDataIngestionAdapter.ts`
- Test: `Backend/HBOS/test/FinancialDataIngestionAdapter.test.ts`
- Documentation: this file

The implementation remains outside the Engine hierarchy and does not create a duplicate Financial Intelligence Engine.

## Verified behavior

- CSV source evidence includes SHA-256 provenance.
- Tenant identity is required and retained in the canonical model.
- CSV headers and rows are validated before persistence.
- Debit and credit totals are independently calculated.
- The canonical model is persisted under the tenant scope.
- Invalid schema is rejected before persistence.

The autonomous construction loop must preserve these existing public contracts and may only enrich behavior from repository evidence, dependencies, tests and the durable product roadmap.
