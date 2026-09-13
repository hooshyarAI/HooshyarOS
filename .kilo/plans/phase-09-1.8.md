# Phase 09 — Stage 09-1.8 — Checkpoint

## ID
09-1.8

## Objective
Add scenario analysis to RiskIntelligenceEngine.

## Owner
Backend/HBOS/Engines/RiskIntelligenceEngine.ts

## Dependencies
- 09-1.7 (96fa3b2b)

## Scope
- scenario({base, scenarios, model}): base output + per-scenario output, delta, pctChange
- 6 unit tests covering base/up/down, invalid model, NaN, non-finite outputs, per-entry BLOCKED status

## Verification
- 6 new tests PASS
