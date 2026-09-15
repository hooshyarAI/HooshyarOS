# Phase 08-ENT.1 — Generic API Acquisition Contract — Checkpoint

## Stage
- **Stage ID:** 08-ENT.1
- **Title:** Generic API Acquisition Contract
- **Phase:** 08 — Universal Data Acquisition
- **Parent Stage:** 08
- **Owner:** Backend/HBOS/Product/FinancialDataIngestionAdapter.ts
- **Status:** COMPLETE
- **Timestamp:** 2026-09-03T19:48:00Z
- **Commit SHA:** c118d9f9c7530876aa40ee4ed286cfd688dd7460

## Implementation
- New module: `Backend/HBOS/Product/GenericApiConnector.ts`
  - `AuthStrategy` abstract interface; concrete impls live in tenant code
  - `RateLimiter` + `TokenBucketRateLimiter` (capacity, refillPerSecond, injectable clock)
  - `ApiTransport` interface (Node built-in `fetch` default; injected for tests)
  - `GenericApiConnector`:
    - `fetchPage(cursor)`, `fetchAll()` (cursor pagination via `x-next-cursor` header)
    - 429 -> RATE_LIMITED, non-2xx -> PAGINATION_FAILED
    - maxPages cap, pageSize
  - `API_ERROR_CODES = { ENDPOINT_REQUIRED, RATE_LIMITED, AUTH_REQUIRED, RESPONSE_INVALID, PAGINATION_FAILED, SECRET_LEAK_BLOCKED }`
  - Header redaction in warning logs (any header containing auth/token/key/secret)
- Canonical owner NOT modified.

## Inputs
- endpoint, auth strategy, rateLimiter, pageSize, maxPages, validateAndMap, transport, logger

## Outputs
- GenericApiFetchResult { pages, rows }

## Verification Metric
- `npm test -- --testPathPattern="GenericApiConnector"` — 9/9 PASS
- baseline 61 preserved

## Resource Policy
- Token-bucket rate limiter; configurable capacity and refill rate.
- maxPages cap (default 1000).

## Security Controls
- No real network in tests (transport injection).
- Auth header values never logged in plaintext; redacted in any warning.
- 429 surfaced as RATE_LIMITED so caller can apply backoff.

## Known Limitations
- No automatic auth refresh; concrete AuthStrategy must do it.
- Cursor header name is fixed to `x-next-cursor`.

## Resume Condition
- N/A — stage complete.

## Blocked By
- None.

## Next
- 08-ENT.2 — Generic Database Acquisition Contract.