# Phase 10-3 Identity Hardening Checkpoint

## STATUS
VERIFIED

## PHASE
Phase 10 Micro-Stage 3 — Harden identity/session creation in CommercialIdentityService / CommercialRuntimeServer

## SCOPE
Minimum viable identity proof and session lifetime controls without redesigning auth.

## CHANGES
1. `Backend/HBOS/Product/CommercialIdentityService.ts`
   - Added `hashPassword(password)` / `verifyPassword(password, hash)` (instance + static) using Node.js built-in `crypto.scrypt` with `crypto.randomBytes(16)` salt. Format: `scrypt$<saltHex>$<hashHex>`. Constant-time comparison via `Buffer.equals`.
   - Extended `CommercialSession` with `createdAt` and `expiresAt` (ISO strings). Default TTL = 1 hour, configurable via `setSessionTtl()`.
   - Added `setNowProvider()` for deterministic testing.
   - `getSession()` now rejects expired sessions (returns null, marks active=false, emits `SESSION_EXPIRED` audit event).
   - Extended `IdentityAuditEvent` with `SESSION_EXPIRED` event type.

2. `Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts`
   - Extended internal `Session` with `createdAt` / `expiresAt` numeric fields.
   - Added `sessionTtlMs` (default 1 hour) and `now` options to `CommercialRuntimeOptions`.
   - Cookie-validated sessions are expired before any route handling; expired session returns 401 `AUTHENTICATION_REQUIRED` and is removed from the in-memory map.
   - `/api/session` POST response now includes `expiresAt`. `/api/session` GET response includes `expiresAt`.

3. `Backend/HBOS/test/Phase10-3.IdentityHardening.test.ts`
   - 5 tests for password hashing (round-trip, wrong-password rejection, malformed-hash rejection, salt uniqueness, instance-method delegation).
   - 3 tests for CommercialIdentityService session expiration (createdAt/expiresAt presence, expired getSession, expired authorize).
   - 3 tests for CommercialRuntimeServer session expiration (fresh session works, expired session returns 401 on /api/dashboard, expired session returns 401 on /api/session).

## VERIFICATION EVIDENCE
- Focused test: `Phase10-3.IdentityHardening.test.ts` — 11/11 tests PASS.
- Regression tests for affected modules:
  - `CommercialIdentityService.test.ts` — PASS
  - `CommercialRuntimeBusinessFlow.test.ts` — PASS
  - `CommercialRuntimePersistenceRecovery.test.ts` — PASS
  - `CommercialRuntimeEntrypoint.test.ts` — PASS
  - `ExecutiveIntelligenceWorkbench.runtime.test.ts` — PASS
  - `SecurityEventLogger.phase-10-1.3.test.ts` — PASS
- `CommercialWebEntrypoint.test.ts` is a pre-existing failure (web/ asset 404 when `process.cwd()` is not the repo root); unrelated to this phase.

## RULES RESPECTED
- No new engines created; reused existing `CommercialIdentityService`.
- No new dependencies; only Node.js built-in `crypto`.
- Architecture Freeze V4 preserved.
- No `git add .`; only intentional files staged.
- Session lifetime added without redesigning auth.

## NEXT PHASE
Phase 10-4 (or next genuine gap per repository audit).
