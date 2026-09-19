# Phase 13-1.1 — Real UserManagementEngine

**Phase:** 13
**Stage ID:** 13-1.1
**Title:** Real UserManagementEngine (persistent users, password hashing, session lifecycle)
**Owner:** UserManagementEngine
**Status:** VERIFIED
**Commit:** `c6d45254`

## Delivered
- `Backend/HBOS/Engines/UserManagementEngine.ts` rewritten from stub to real persistent engine.
- `Backend/HBOS/Core/TenantIdentity.ts` canonical tenant derivation.
- `Backend/HBOS/Product/SQLitePersistenceStore.ts` exposes the shared connection for typed repository tables.

## Contract
- `registerUser(username, password, organization, role?)` — validated, duplicate-safe, tenant-scoped.
- Salted `scrypt` password hashes; plaintext never persisted.
- `authenticate`, `createSessionForUser`, `validateSession`, `refreshSession`, `logout`, `cleanupExpiredSessions`.
- `getUserById`, `getUserByUsername`, `listUsers(tenantId)`, `updateUserRole`, `blockUser`, `unblockUser`, `hasRole`.
- `ensureBootstrapUser` + `setPassword` for legacy onboarding.

## Evidence
`Backend/HBOS/test/UserManagementEngine.test.ts` — **11/11 PASS** covering validation, hashed persistence, tenant isolation, credential rejection, TTL/expiry/refresh/logout, bulk cleanup, role hierarchy and bootstrap provisioning.
