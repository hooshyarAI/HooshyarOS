# User Management Engine

Canonical Phase 2 capability, upgraded in Phase 13-1.1 to a real persistent identity contract. Governed by HBOS Core and Governance Engine.

## Ownership
Owns persistent user identity, password material and session lifecycle for a tenant boundary.

## Persistence
Uses `SQLitePersistenceStore`. Users are stored in the `users` table and sessions in the `sessions` table. Every read and write is tenant-scoped by `tenantId`, which is derived canonically from the organization name.

## Security
- Passwords are never stored in plaintext.
- Each account carries a random 16-byte salt and an `scrypt`-derived hash.
- Verification uses constant-time comparison.
- Accounts created without a password (`ensureBootstrapUser`) are `PENDING_VERIFICATION` and cannot authenticate until `setPassword` is called.

## Contract
- `registerUser(username, password, organization, role?)` — persistent credentialed registration.
- `ensureBootstrapUser(username, organization, role?)` — passwordless owner provisioning for legacy onboarding.
- `setPassword(userId, password)`.
- `authenticate(username, password, organization)` — verifies credentials, records `lastLoginAt`, creates a session.
- `createSessionForUser(user)`, `getSessionRecord(token)`, `validateSession(token)`, `refreshSession(token)`, `logout(token)`, `cleanupExpiredSessions()`.
- `getUserById`, `getUserByUsername`, `listUsers(tenantId)`, `updateUserRole`, `blockUser`, `unblockUser`, `hasRole`.

## Dependencies
HBOS Core, Tenant Identity (`Core/TenantIdentity`), `SQLitePersistenceStore`.

## Verification
`Backend/HBOS/test/UserManagementEngine.test.ts` covers registration validation, hashed persistence, tenant isolation, credential rejection, session expiry/refresh/logout, role hierarchy and bootstrap provisioning.
