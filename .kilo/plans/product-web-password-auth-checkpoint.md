# Checkpoint — `product.web-password-auth` (web password authentication)

**Status:** VERIFIED — ready to commit
**Branch:** `fix/autonomous-product-factory`
**Trusted baseline:** `0235f6cc8a96ddc7eca627666a3faff30ac29438`
**Architecture:** Architecture Freeze V4.1 (unchanged)
**Classification:** REAL PRODUCT/USABILITY GAP (web entrypoint only exposed passwordless bootstrap; no register/login UI) — wired to the existing canonical backend; no new auth architecture
**Authority:** `.kilo/plans/ACTIVE-COMMERCIALIZATION-MASTER-LEDGER.md` §3.4 (S1); audit §35

---

## Knot

One coherent product knot: expose the **real password authentication path** in the web entrypoint using the already-verified canonical backend (`/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/session`), without creating a second authentication architecture and without weakening the passwordless bootstrap gate.

One capability = one owner = one implementation = one test = one commit.

## Defect (exact)

`web/index.html` + `web/app.js` exposed only a passwordless `POST /api/session` form. After the identity-bootstrap hardening, passwordless bootstrap is denied for established organizations, so the shipped web UI could not register or log in with a password — the real `/api/auth/*` backend path existed but was unreachable from the product UI.

## Repair

- `web/index.html`: replaced the single passwordless onboarding form with real **register** (`#register-form`, username + organization + new password) and **login** (`#login-form`, username + organization + password) forms plus a **logout** button. Password inputs use `type="password"` and appropriate `autocomplete` hints.
- `web/app.js`: added `refreshSessionState()` (calls `GET /api/session`), `wireAuthForm(...)` (calls `POST /api/auth/register` / `POST /api/auth/login` and clears the password field on success), and a logout handler (`POST /api/auth/logout`); the client surfaces invalid-credential/registration errors from the server response.

No backend change was required or made; the canonical `CommercialIdentityService` remains the sole auth owner and its passwordless bootstrap decision gate is untouched.

## Behavioral tests (real HTTP)

`Backend/HBOS/test/CommercialWebEntrypoint.test.ts`:

- Switched the served runtime to `databasePath: ":memory:"` (no repo DB pollution; per-run unique credentials).
- Asset test now asserts the shell exposes the register/login/logout controls and that `app.js` calls `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` (and still `/api/session`, `/api/dashboard`).
- New HTTP end-to-end test exercising the exact path the web client uses:
  1. `POST /api/auth/register` → **201**, `authenticated: true`, `role: OWNER`, session cookie issued;
  2. `POST /api/auth/login` with a wrong password → **401 `INVALID_CREDENTIALS`**;
  3. `POST /api/auth/login` with the correct password → **200** + cookie;
  4. `GET /api/session` with the cookie → **200**, matching username;
  5. **authorization integration**: `GET /api/sources` (owner `READ_DASHBOARD`) → **200** with the tenant id; anonymous `GET /api/sources` → **401**;
  6. `POST /api/auth/logout` → **200**, then `GET /api/session` with the same cookie → **401**.

## Verification

| Check | Command / artifact | Result |
|---|---|---|
| Focused | `jest …CommercialWebEntrypoint.test.ts --runInBand` | **1 suite, 2/2 tests passed** |
| Integration regression | 16 runtime/auth/web suites | **16/16 suites, 101/101 tests passed** |
| Changed-file typecheck | `tsc --noEmit` (web test) | **exit 0** |
| Full suite | `jest --silent` → `.kilo/evidence/jest-full-stage4-web-password-auth.txt` | **256/259 suites, 1959/1961 tests**; web entrypoint passes under full load |

## Remaining failures (pre-existing, independently classified — not caused by this knot)

| Suite | Class |
|---|---|
| `test/CommercialRuntimePersistenceRecovery.test.ts` | TIMING/RESOURCE FLAKE (5 s budget under full parallel load; passes in isolation) |
| `Autonomous/Runtime/KiloCodeExecutionAdapter.test.ts` | TIMING/RESOURCE FLAKE (real Windows parent+child timeout; passes in isolation) |
| `test/OcrAdapter.test.ts` | ENVIRONMENT GAP (`tesseract.js` absent) |

## Changed files

- `web/index.html`
- `web/app.js`
- `Backend/HBOS/test/CommercialWebEntrypoint.test.ts`
- `.kilo/evidence/jest-full-stage4-web-password-auth.txt`
- `.kilo/plans/product-web-password-auth-checkpoint.md`
- `.kilo/plans/platform-wide-commercialization-conformance-audit.md` (§35)
- `.kilo/plans/ACTIVE-COMMERCIALIZATION-MASTER-LEDGER.md`
- `.kilo/plans/AUTONOMOUS-COMMERCIALIZATION-EXECUTION-QUEUE.md`

## Architecture proof

No engine moved or duplicated; no second authentication architecture; `CommercialIdentityService` remains the sole identity owner; the passwordless bootstrap decision gate is unchanged; Architecture Freeze V4.1 preserved.

## Truth boundary

No change to `productComplete`, `commercialProductRuntimeComplete` or `externalProductionDependenciesComplete`. No assertion weakened, no test skipped or deleted. No credential material is logged; passwords are only held in the request body and cleared from the form on success. Transport security (TLS) remains an external production dependency.

## Next candidate knot (not executed)

`security.http-boundary-tenant-object-authz` — invoke `TenantIsolation.checkAccess()` and explicit object-owner checks at the HTTP boundary (no service-level-only checks).
