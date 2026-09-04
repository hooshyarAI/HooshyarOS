# Phase 09 — Stage 09-1.15 — Checkpoint

## ID
09-1.15

## Objective
Add OrchestratedDecisionIntelligenceService that composes FinancialIntelligenceEngine, RiskIntelligenceEngine and DecisionIntelligenceEngine into a single tenant-scoped summary.

## Owner
Backend/HBOS/Product/OrchestratedDecisionIntelligenceService.ts

## Dependencies
- 09-1.14 (28511c10)
- 09-1.10/11/12 (60c4023d)
- 09-1.7/8 (96fa3b2b / 65f66ee2)
- 09-1.1..1.4 (3f95be6c / dd481966 / 66c2b97b / 11ea37d1)

## Scope
- orchestrate(input): financial + risk + decision summary, tenantId propagated
- 7 unit tests covering full READY, missing tenant, per-section BLOCKED preservation, AHP/TOPSIS invalidity, NaN/Infinity stability

## Verification
- 7 new tests PASS
