# Commercialization Checkpoint — `product.secure-identity-bootstrap`

**Status:** VERIFIED
**Branch:** `fix/autonomous-product-factory`
**Capability:** `product.secure-identity-bootstrap` (security hardening of the existing identity owner — NOT a new capability owner)
**Canonical owner:** `Backend/HBOS/Product/CommercialIdentityService.ts`
**Runtime surface:** `POST /api/session` in `Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts`
**Architecture change:** NONE (composition/hardening of the existing identity boundary).

---

## Defect closed

`POST /api/session` with no password called `identity.createSession(username, organization, "OWNER")`
with no authorization check. Any unauthenticated caller could name an arbitrary organization and:

- receive an `OWNER` session for it (cross-tenant privilege escalation), or
- seize an already-activated account by reusing its username+organization.

This broke the tenant boundary in layer 3 (multi-tenancy/authorization) and contradicted the
mission rule "DO NOT BYPASS TENANT ISOLATION".

## Fix

A security gate, `CommercialIdentityService.passwordlessBootstrapDecision(username, organization)`,
is enforced by the runtime before any passwordless bootstrap:

- **Brand-new (unclaimed) organization** → allowed; first owner may onboard passwordlessly.
- **Existing not-yet-activated bootstrap account** (same username+organization) → allowed; preserves
  restart/recovery compatibility.
- **New username inside an established organization** → denied `403 ORGANIZATION_ALREADY_ESTABLISHED`.
- **Already-activated (password-bearing) account** → denied `403 PASSWORD_AUTHENTICATION_REQUIRED`
  (must use `/api/auth/login`).
- **Blocked account** → denied `403 ACCOUNT_BLOCKED`.

`createSession()` semantics are unchanged for internal/direct callers; the gate is applied at the
HTTP boundary where the vulnerability existed.

## Evidence

- **Unit/security:** `Backend/HBOS/test/CommercialSessionBootstrapSecurity.test.ts` — 4/4 PASS
  (new-org bootstrap; established-org takeover denied; active-account seizure denied then real login
  succeeds; pending-account resume preserved).
- **Focused regression:** 18 suites / 94 tests PASS across every `/api/session` consumer:
  `CommercialRuntimeServer.e2e`, `CommercialRuntimePersistenceRecovery`, `CommercialIdentityService`,
  `TenantIsolationVerification`, `Phase13-E2E`, `Phase13-RBAC`, `Phase10-3.IdentityHardening`,
  `CommercialRuntimeBusinessFlow`, `CommercialAuthenticationAuthorizationBoundary`, `Phase12-E2E`,
  `Phase08-09.OperationalClosure`, `FinalProductRuntimeQualification`,
  `ExecutiveIntelligenceWorkbench.runtime`, `CommercialWebEntrypoint`,
  `CommercialRuntimeServer.resilience`, `CommercialRuntimeServer.rateLimiting`,
  `CommercialRuntimeApiValidation`, `CommercialSessionBootstrapSecurity`.
- **Application acceptance:** `node scripts/security-tenant-acceptance.cjs` → **PASS v4** with new
  `bootstrapHardening: true` and assertions `passwordless-bootstrap-takeover-denied`,
  `passwordless-bootstrap-active-account-seizure-denied`; all prior tenant/report assertions retained.
- **Web acceptance:** `node scripts/web-product-acceptance.cjs` → **PASS** (fresh-org onboarding path
  unaffected).
- **Typecheck:** changed files clean — 0 errors in `CommercialIdentityService.ts`,
  `CommercialRuntimeServer.ts`, `CommercialSessionBootstrapSecurity.test.ts` (repo-wide
  `tsc --noEmit` still reports only pre-existing errors in retired/stale files).

## Regression classification

- **NEW REGRESSION: none in product behavior.**
- One test setup adjusted (not weakened): `CommercialRuntimeServer.rateLimiting.test.ts` created two
  passwordless sessions in the *same* organization ("qa"/"qb") solely to obtain two cookies. Under the
  hardened policy that is correctly denied, so the two sessions now use distinct organizations
  (`org-a`/`org-b`). The rate-limiting assertion is unchanged and still 4/4 PASS.
- Pre-existing failures unchanged: the 9 compile-failing suites + `LocalFolderWatcher` native crash
  catalogued in `.kilo/plans/platform-wide-commercialization-conformance-audit.md` §16.

## Truthful boundary

This closes the unauthenticated owner/tenant takeover and the active-account seizure. It does **not**
add encryption-at-rest, SSO, password recovery, or remove the legacy passwordless first-owner path.
Residual debt: a never-activated bootstrap account can still be claimed by someone who knows its exact
username+organization; once a password is set it is protected. Tracked, not hidden.

## Remaining debt / next stage

1. Wire real register/login (password) into `web/index.html` + `web/app.js` (UI still uses passwordless bootstrap only).
2. Repair the degraded test-evidence base (9 compile-failing suites + `LocalFolderWatcher` process-abort).
3. Rate-limit `/api/auth/*`.
4. Metrics/tracing; pagination/idempotency; encryption-at-rest (blocked on 05C human approval).
