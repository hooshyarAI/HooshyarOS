# Phase 09 — Stage 09-1.13 — Checkpoint

## ID
09-1.13

## Objective
Add RatioAnalysisService (product service) for vertical/horizontal analysis and profitability/leverage ratios.

## Owner
Backend/HBOS/Product/RatioAnalysisService.ts

## Dependencies
- 09-1.12 (60c4023d)

## Scope
- vertical(statement, base): % of revenue or totalAssets
- horizontal(current, prior): period-over-period change
- profitability(statement): grossMargin, operatingMargin, netMargin, ROA, ROE
- leverage(statement): debtToEquity, debtToAssets, equityRatio
- 8 unit tests

## Verification
- 8 new tests PASS
