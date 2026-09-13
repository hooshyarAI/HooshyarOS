# Phase 09 — Stage 09-1.6 — Checkpoint

## ID
09-1.6

## Objective
Add CashFlowForecastingService with naive, moving-average and linear-trend forecast methods.

## Owner
Backend/HBOS/Product/CashFlowForecastingService.ts

## Dependencies
- 09-1.5 (c1063ea0)

## Scope
- naive(series, horizon)
- movingAverage(series, window, horizon)
- linearTrend(series, horizon) — OLS regression
- 9 unit tests

## Verification
- 9 new tests PASS
