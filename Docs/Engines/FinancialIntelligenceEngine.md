# Financial Intelligence Engine

Canonical financial intelligence capability for HBOS.

## Responsibility

Provides the canonical financial-intelligence layer for financial analysis and downstream budget and tax intelligence capabilities.

## Dependencies

- Reasoning Engine
- Governance Engine

## Evidence

- Backend/HBOS/Engines/FinancialIntelligenceEngine.ts
- Backend/HBOS/test/FinancialIntelligenceEngine.test.ts

## Verification

Focused verification is provided by:

Backend/HBOS/test/FinancialIntelligenceEngine.test.ts


## Financial denominator safety

- Debt ratio is defined as liabilities divided by assets. When assets are zero, the ratio is undefined and the engine must return `BLOCKED` with `DEBT_RATIO_DENOMINATOR_ZERO`; it must not report a misleading zero ratio.
- Other invalid finite/range inputs return `BLOCKED` with `INVALID_FINANCIAL_INPUT`.
- A blocked analysis is not added to successful analysis history.
- Focused engine and commercial-runtime tests cover zero assets with both positive and zero liabilities, reason propagation, and non-persistence.
