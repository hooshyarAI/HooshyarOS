# Phase 08-AUTO.3 — Retry / Error Recovery — Checkpoint

## Stage
- **Stage ID:** 08-AUTO.3
- **Title:** Retry / Error Recovery
- **Phase:** 08 — Universal Data Acquisition
- **Parent Stage:** 08
- **Owner:** Backend/HBOS/Product/FinancialDataIngestionAdapter.ts
- **Status:** COMPLETE
- **Timestamp:** 2026-09-03T19:38:00Z
- **Commit SHA:** 0516a22f15cdb513d05bd18fcc518503ad1c289b

## Implementation
- New module: `Backend/HBOS/Product/RetryWithBackoff.ts`
  - `retryWithBackoff(operation, fn, options, deadLetterSink)` -> Promise<T>
  - Bounded retry with exponential backoff (configurable: maxAttempts,
    initialBackoffMs, maxBackoffMs, backoffMultiplier, jitter)
  - Dead-letter persistence via caller-supplied sink (no retry storm)
  - `RetryExhaustedError` (preserves `attempts` + `lastError`)
  - AbortSignal support, isRetryable predicate, onRetry observability hook
  - Injectable `sleep` for deterministic tests
  - `RETRY_ERROR_CODES = { NEGATIVE_ATTEMPTS, EXHAUSTED }`
- Canonical owner NOT modified.

## Inputs
- async operation, retry options, deadLetter sink

## Outputs
- T on success; RetryExhaustedError on exhaustion

## Verification Metric
- `npm test -- --testPathPattern="RetryWithBackoff"` — 7/7 PASS
- baseline 61 preserved

## Resource Policy
- Default 3 attempts, backoff 100ms..5s, jitter 0.1 (all configurable).

## Security Controls
- AbortSignal prevents runaway retries.
- Non-retryable errors fail fast (no retry storm).
- Dead-letter sink ensures no failed operation is silently dropped.

## Known Limitations
- No built-in dead-letter storage; the sink is caller-supplied so
  downstream code can wire it to the canonical SQLitePersistenceStore.

## Resume Condition
- N/A — stage complete.

## Blocked By
- None.

## Next
- 08-ENT.1 — Generic API Acquisition Contract.