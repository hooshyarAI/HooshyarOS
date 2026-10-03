# Checkpoint — `security.auth-route-rate-limiting` (authentication hardening)

**Status:** VERIFIED — ready to commit
**Branch:** `fix/autonomous-product-factory`
**Trusted baseline:** `c422c4c01364b4c8cc2371e51f8353592b0bdc21`
**Architecture:** Architecture Freeze V4.1 (unchanged)
**Classification:** REAL SECURITY DEFECT (unauthenticated auth entry points had no brute-force limit) — repaired in the canonical runtime owner
**Authority:** `.kilo/plans/ACTIVE-COMMERCIALIZATION-MASTER-LEDGER.md` §3.4 (S2); audit §34

---

## Knot

One coherent security knot: apply the existing canonical `TokenBucketRateLimiter` to the authentication entry points, which being unauthenticated cannot use the per-session limiter. No new engine, no new limiter architecture, no parallel auth path.

One capability = one owner = one implementation = one test = one commit.

## Defect (exact)

`CommercialRuntimeServer` limited only per-session (`session.token`) routes. `POST /api/auth/register`, `POST /api/auth/login`, and `POST /api/session` are handled **before** the session gate, so an unauthenticated caller could make unlimited credential-guessing / account-registration requests (audit R6). There was also no cross-route protection: limiting only `/api/auth/login` would leave the password form of `/api/session` as a bypass.

## Repair (canonical owner)

`Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts`:

- Added a **per-client** limiter (keyed by `req.socket.remoteAddress`, capacity 20, refill 5/s) checked **before** the request body is read.
- Added a **per-identity** limiter (keyed by client address + normalized `username` + `organization`, capacity 5, refill 1/s) checked after the credential fields are validated and **before** credential verification.
- `/api/auth/login` and the password form of `/api/session` share the same per-identity bucket, so switching route cannot bypass the limit. The passwordless bootstrap form of `/api/session` is limited by the same per-identity bucket.
- Blocks fail closed with `429 { error: "RATE_LIMIT_EXCEEDED" }` and a `Retry-After: 1` header, and emit a `RATE_LIMIT_EXCEEDED` authentication-failure security event through the existing `SecurityEventLogger` when configured.
- Added the truthful `auth-rate-limiting` capability to `/api/ready`.

Uses the existing `TokenBucketRateLimiter` (`Product/GenericApiConnector.ts`) and the existing `now` provider — no test-only mock, no duplicate limiter.

## Behavioral tests (real HTTP, strengthened)

`Backend/HBOS/test/CommercialRuntimeServer.rateLimiting.test.ts` — new `describe("CommercialRuntimeServer auth route rate limiting")` covering:

1. Repeated failed `/api/auth/login` attempts for one identity → 401×5 then **429** with `Retry-After: 1`.
2. Password form of `/api/session` shares the identity limit (correct password still **429** after the login route is exhausted → no route bypass).
3. Identity limit is isolated per account (owner blocked, other account still **200**).
4. Identity limit **resets** after the refill window (deterministic injected `now`; blocked → 401 after +6 s).
5. Client-level limit blocks credential stuffing across many identities (20 allowed, 21st **429**).
6. Rate-limited authentication emits an auditable `RATE_LIMIT_EXCEEDED` security event (real SQLite audit store).

## Verification

| Check | Command / artifact | Result |
|---|---|---|
| Focused | `jest …CommercialRuntimeServer.rateLimiting.test.ts --runInBand` | **1 suite, 10/10 tests passed** |
| Integration regression | 16 runtime/auth/tenant/e2e suites (`e2e`, `resilience`, `Phase1[0-4]`, identity hardening, bootstrap security, RBAC, web entrypoint, business flow, reports export, final qualification) | **16/16 suites, 100/100 tests passed** |
| Changed-file typecheck | `tsc --noEmit` (server + test) | **exit 0** |
| Full suite | `jest --silent` → `.kilo/evidence/jest-full-stage3-auth-rate-limiting.txt` | **257/259 suites, 1959/1960 tests**; the rate-limiting suite passes under full load |

## Remaining failures (pre-existing, independently classified — not caused by this knot)

| Suite | Class |
|---|---|
| `test/CommercialRuntimePersistenceRecovery.test.ts` | TIMING/RESOURCE FLAKE (5 s test budget under full parallel load; passes in isolation) |
| `test/OcrAdapter.test.ts` | ENVIRONMENT GAP (`tesseract.js` absent) |

## Changed files

- `Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts`
- `Backend/HBOS/test/CommercialRuntimeServer.rateLimiting.test.ts`
- `.kilo/evidence/jest-full-stage3-auth-rate-limiting.txt`
- `.kilo/plans/security-auth-route-rate-limiting-checkpoint.md`
- `.kilo/plans/platform-wide-commercialization-conformance-audit.md` (§34)
- `.kilo/plans/ACTIVE-COMMERCIALIZATION-MASTER-LEDGER.md`
- `.kilo/plans/AUTONOMOUS-COMMERCIALIZATION-EXECUTION-QUEUE.md`

## Architecture proof

No engine moved or duplicated; no new authentication architecture; the canonical `TokenBucketRateLimiter` and `CommercialIdentityService` are reused; `/api/session` passwordless bootstrap decision gate is untouched; Architecture Freeze V4.1 preserved.

## Truth boundary

No change to `productComplete`, `commercialProductRuntimeComplete` or `externalProductionDependenciesComplete`. No assertion weakened, no test skipped or deleted. The new heavy audit test received an explicit 20 s budget to accommodate real file-backed audit persistence under full-suite load — coverage and assertions are unchanged.

## Next candidate knot (not executed)

`product.web-password-auth` — real password register/login in the web entrypoint using the existing `/api/auth/*` routes (no new engine).
