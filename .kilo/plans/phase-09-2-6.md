# Phase 09 — Stage 09-2.6 — Checkpoint

## ID
09-2.6

## Objective
Add AnomalyDetectionService with z-score, IQR, and modified z-score detectors.

## Owner
Backend/HBOS/Product/AnomalyDetectionService.ts

## Dependencies
- 09-1.14 (28511c10)

## Scope
- zscore(series, warnZ, alertZ)
- iqr(series, k)
- modifiedZ(series, warnC, alertC)
- 8 unit tests

## Verification
- 8 new tests PASS
