# Phase 10 — Micro-Stage 10-1.4: Fine-Grained ABAC Policy Engine

## Objective
Extend AuthorizationGuard with attribute-based access control (ABAC) policy evaluation, enabling fine-grained policies based on subject, resource, and environment attributes.

## Owner
AuthorizationGuard (`Backend/HBOS/Security/AuthorizationGuard.ts`)

## Preconditions
- Phase 05C authorization rules exist and are tested
- AuthorizationGuard.check() provides RBAC-style permission checking

## Dependencies
- `../Security/Authorization` — Authorization enum, AuthorizationResult enum
- `../Security/SecurityContext` — SecurityContext
- `../Security/Principals` — PrincipalType

## Scope
- Add ABAC rule type: `AbacRule` with effect (ALLOW/DENY) and attribute condition
- Add `evaluateAbacPolicy(context, action, resourceAttributes, rules): AbacPolicyResult`
  - DENY rules take precedence over ALLOW rules
  - Falls back to RBAC check via existing AuthorizationGuard.check() if no ABAC rules match
  - Returns traceId from context
- Add `abacCheck(context, action, resourceType, resourceAttributes, rules): AbacPolicyResult`
  - Convenience wrapper combining ABAC + tenant boundary check
- DO NOT modify existing check(), checkTenantScoped(), checkAutonomousExecute(), checkEvidenceAccess()

## Implementation Boundary
- DO NOT modify Phase 05C authorization logic
- DO NOT break existing AuthorizationGuard tests
- All new methods synchronous and deterministic
- ABAC rules are additive — existing RBAC behavior preserved when no ABAC rules provided

## Verification Metric
- AuthorizationGuard.phase-10-1.4.test.ts: 15+ focused tests PASS
- Existing AuthorizationGuard tests: PASS
- Existing SecurityLayerEngine tests: PASS

## Checkpoint Condition
- All new tests pass
- ABAC policy correctly applies deny-overrides semantics
- RBAC fallback works when no ABAC rules match
- Existing RBAC authorization behavior unchanged

## Failure Boundary
- If existing authorization tests break, rollback to trusted checkpoint

