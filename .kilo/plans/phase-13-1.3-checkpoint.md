# Phase 13-1.3 — RBAC / Permission System

**Phase:** 13
**Stage ID:** 13-1.3
**Title:** RBAC/permission system wired to the frozen AuthorizationGuard
**Owner:** CommercialIdentityService / Security
**Status:** VERIFIED
**Commit:** `c6d45254`

## Delivered
- Canonical role set `OWNER | ADMIN | MANAGER | ANALYST | VIEWER` and role→authorization grants.
- Commercial permissions map to frozen `Security/Authorization` actions
  (`READ_DASHBOARD→READ`, `INGEST_DATA→WRITE`, `CREATE_DECISION→EXECUTE`, `MANAGE_USERS→ADMINISTER`).
- `CommercialIdentityService.hasPermission` / `authorize` build a `SecurityContext`
  (HumanUser principal + tenant) and evaluate through `SecurityLayerEngine.evaluatePolicy`,
  which composes `AuthorizationGuard` (deny by default) and `TenantIsolation` (tenant mismatch denies).
- First organization member becomes `OWNER`; later members default to `VIEWER`.
- Authorization allow/deny events are recorded in the identity audit trail.

## Evidence
`Backend/HBOS/test/Phase13-RBAC.test.ts` — role matrix, privilege elevation, cross-tenant denial and audit events pass.
