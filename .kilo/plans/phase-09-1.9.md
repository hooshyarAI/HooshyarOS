# Phase 09 — Stage 09-1.9 — Checkpoint

## ID
09-1.9

## Objective
Add simple exponential smoothing (SES) product service.

## Owner
Backend/HBOS/Product/ExponentialSmoothingService.ts

## Dependencies
- 09-1.8 (65f66ee2)

## Scope
- ses(series, alpha, horizon): fitted + forecast + in-sample MAE
- 7 unit tests covering alpha=0, alpha=1, alpha=0.5 known calculations, invalid alpha, NaN, finite stability

## Verification
- 7 new tests PASS
