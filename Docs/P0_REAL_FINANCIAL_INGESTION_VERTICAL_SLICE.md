# P0 — Real Financial Data Ingestion Vertical Slice

## Contract

The first supported financial source path is a CSV export with explicit source provenance:

`source evidence → ingestion → schema validation → row validation → canonical normalization → tenant-scoped persistence → FinancialIntelligenceEngine analysis`

The source SHA-256 is retained in the canonical model and persistence key. Financial account semantics are accepted only when the source provides `accountType` (`ASSET`, `LIABILITY`, `REVENUE`, `EXPENSE`). The adapter does not infer financial meaning from account names.

## Evidence

`Backend/HBOS/Product/FinancialDataIngestionAdapter.ts`

The focused test demonstrates:

- source evidence and SHA-256 provenance;
- canonical transaction normalization;
- tenant-scoped persistence;
- rejection before persistence for invalid double-sided rows;
- hand-off to `FinancialIntelligenceEngine` for typed financial sources;
- persistence of the resulting financial analysis.

## Boundary

This establishes an implementation-level vertical slice. It does **not** yet establish production acceptance for every Iranian accounting/ERP connector, tax/reporting standard, encoding convention, or deployment environment.

Therefore the capability advances to:

`BEHAVIORALLY VERIFIED` for the focused supported CSV contract.

It does not automatically advance to `PRODUCTION VERIFIED` or `COMMERCIAL READY`.
