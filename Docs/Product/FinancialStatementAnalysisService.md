# FinancialStatementAnalysisService

Canonical product capability: `product.financial-statement-analysis`.

Target engine: Financial Intelligence Engine

## Capability

Analyze a tenant-scoped financial statement summary whose source provenance has already been verified, preserve that evidence, reuse the canonical financial calculations, and expose a fail-closed reasoning-evidence gate.

## Dependencies

- Financial Intelligence Engine
- Reasoning Engine
- Source evidence from `FinancialDataIngestionAdapter`

## Construction boundary

- Implementation: `Backend/HBOS/Product/FinancialStatementAnalysisService.ts`
- Test: `Backend/HBOS/test/FinancialStatementAnalysisService.test.ts`
- Documentation: this file

The service remains outside the Engine hierarchy. Financial calculations remain owned by `FinancialIntelligenceEngine`; this product service composes that contract with tenant/source evidence and the existing reasoning boundary.

## Verified behavior

- Requires a non-empty tenant identity.
- Requires source provenance matching the repository-owned `FinancialSourceEvidence` contract.
- Reuses the canonical Financial Intelligence Engine for profit, margin and debt-ratio calculations.
- Does not introduce arbitrary financial thresholds, risk scores, or policy rules.
- Produces only evidence-direct observations: `LOSS` when profit is negative, otherwise `PROFITABLE`.
- Treats the Reasoning Engine as an evidence gate; reasoning failure returns `BLOCKED` rather than claiming explainability that the current reasoning contract does not provide.
- Delegates financial-input validity to the canonical Financial Intelligence Engine instead of duplicating or narrowing its rules.
- Preserves tenant and source evidence in the result.
