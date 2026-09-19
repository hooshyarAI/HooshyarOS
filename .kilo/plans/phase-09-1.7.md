# Phase 09 — Stage 09-1.7 — Checkpoint

## ID
09-1.7

## Objective
Add 1-D sensitivity and N-D tornado analysis to RiskIntelligenceEngine.

## Owner
Backend/HBOS/Engines/RiskIntelligenceEngine.ts

## Dependencies
- 09-1.6 (eaaa0299)

## Scope
- sensitivity({base, deltas, model}): per-variable sensitivity entries with absolute and elastic change
- tornado({base, deltaPct, model}): N-D tornado ranking by output range
- 7 unit tests, including existing assess contract preservation

## Verification
- 7 new tests PASS
