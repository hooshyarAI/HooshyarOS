# Phase 09 — Stage 09-1.4 — Checkpoint

## ID
09-1.4

## Objective
Add WACC (Weighted Average Cost of Capital) method to FinancialIntelligenceEngine.

## Owner
Backend/HBOS/Engines/FinancialIntelligenceEngine.ts

## Dependencies
- 09-1.3 (66c2b97b)

## Scope
- wacc(input): WACC, equityWeight, debtWeight, afterTaxCostOfDebt
- 8 unit tests including all-equity, all-debt, invalid tax rate, zero capital cases

## Verification
- 8 new tests PASS, 35/35 combined for 09-1.1 + 09-1.2 + 09-1.3 + 09-1.4
