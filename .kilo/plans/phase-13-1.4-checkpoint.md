# Phase 13-1.4 — Session Lifecycle

**Phase:** 13
**Stage ID:** 13-1.4
**Title:** Persistent session lifecycle (TTL, refresh, logout, invalidation)
**Owner:** CommercialIdentityService / CommercialRuntimeServer
**Status:** VERIFIED
**Commit:** `c6d45254`, `78675fbb`

## Delivered
- Persistent `sessions` table owned by `UserManagementEngine`.
- `createSessionForUser`, `validateSession`, `refreshSession`, `logout`, `cleanupExpiredSessions`.
- Injected clock (`setNowProvider`) and TTL (`setSessionTtl`) so expiry is deterministic and testable.
- Expired sessions are invalidated and emit `SESSION_EXPIRED`; refresh extends expiry and emits `SESSION_REFRESHED`.
- Runtime exposes `POST /api/auth/refresh` and `POST /api/auth/logout` with cleared/refreshed HttpOnly cookies.

## Evidence
- `Backend/HBOS/test/Phase13-RBAC.test.ts` session lifecycle cases pass.
- `Backend/HBOS/test/Phase10-3.IdentityHardening.test.ts` (existing expiry assertions) remains green.
