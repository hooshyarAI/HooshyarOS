# Phase 10 — Micro-Stage 10-1.3: Privacy Data Classification & Retention Enforcement

## Objective
Extend SecurityLayerEngine with privacy data classification and retention policy enforcement, integrating with the existing RetentionStore.

## Owner
SecurityLayerEngine (`Backend/HBOS/Engines/SecurityLayerEngine.ts`) / RetentionPolicy (`Backend/HBOS/Entities/RetentionPolicy.ts`)

## Preconditions
- Phase 10-1.1 complete (SecurityLayerEngine extended with classifyData)
- RetentionStore exists with createPolicy, getPolicyForRecordType, checkRetention

## Dependencies
- `../Entities/RetentionPolicy` — RetentionStore, RetentionPolicyConfig, RecordType, RetentionCheckResult
- `../Security/SecurityContext` — SecurityContext

## Scope
- Add `enforceRetention(recordCreatedAt, recordType, tenantId, store): RetentionEnforcementResult`
  - Delegates to RetentionStore.checkRetention()
  - Cross-references data classification for sensitivity context
- Add `classifyDataForRetention(hint, recordType): RetentionClassificationResult`
  - Combines classifyData() output with retention policy recommendations
- Add retention metadata helper: `buildRetentionMetadata(sensitivity, createdAt): RecordRetentionMetadata`
- Preserve backward compatibility — no changes to existing methods

## Implementation Boundary
- DO NOT modify RetentionPolicy.ts interface
- DO NOT modify existing SecurityLayerEngine methods
- All new methods synchronous and deterministic

## Verification Metric
- SecurityLayerEngine.phase-10-1.3.test.ts: 15+ focused tests PASS
- Existing SecurityLayerEngine tests: PASS
- Existing SecurityAuditEngine tests: PASS
- No regressions across full security suite

## Checkpoint Condition
- All new tests pass
- Retention enforcement correctly delegates to RetentionStore
- Data classification feeds into retention decision rationale

## Failure Boundary
- If RetentionStore integration breaks, rollback to trusted checkpoint

