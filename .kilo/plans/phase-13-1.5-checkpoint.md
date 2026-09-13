# Phase 13-1.5 — Wire Auth into Runtime

**Phase:** 13
**Stage ID:** 13-1.5
**Title:** Wire real authentication and RBAC into CommercialRuntimeServer
**Owner:** CommercialRuntimeServer
**Status:** VERIFIED
**Commit:** `78675fbb`

## Delivered
- Removed the in-memory username+organization session stub; the runtime now uses
  `CommercialIdentityService` sessions backed by the persistent identity engines.
- Added `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/refresh`.
- `POST /api/session` remains backward compatible for owner onboarding and accepts an optional password.
- RBAC enforced on all protected endpoints through the canonical policy layer; missing permissions return
  `403 INSUFFICIENT_PERMISSIONS` and are logged through `SecurityEventLogger`.
- HttpOnly, `SameSite=Strict` cookies with an optional `Secure` flag.

## Evidence
- `CommercialRuntimeServer.e2e.test.ts`, `CommercialRuntimeServer.rateLimiting.test.ts`,
  `CommercialRuntimeBusinessFlow.test.ts`, `Phase12-E2E.test.ts` — **25/25 PASS**.
