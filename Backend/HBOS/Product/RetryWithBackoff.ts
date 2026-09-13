/**
 * Stage 08-AUTO.3 — Retry / Error Recovery.
 *
 * Bounded retry helper with exponential backoff. After exhausting
 * retries the failed operation is written to a dead-letter record
 * (caller-supplied deadLetterSink) so the operator can inspect it
 * later. This module is NOT a new Engine; it is a pure helper.
 */

export const RETRY_ERROR_CODES = {
  NEGATIVE_ATTEMPTS: "ingestion-retry-negative-attempts",
  EXHAUSTED: "ingestion-retry-exhausted",
} as const;

export interface RetryOptions {
  /** Maximum number of attempts including the first. Default 3. */
  readonly maxAttempts?: number;
  /** Initial backoff in ms. Default 100. */
  readonly initialBackoffMs?: number;
  /** Backoff cap in ms. Default 5000. */
  readonly maxBackoffMs?: number;
  /** Multiplier per attempt. Default 2. */
  readonly backoffMultiplier?: number;
  /** Optional jitter in [0,1). Default 0.1. */
  readonly jitter?: number;
  /** Predicate to decide whether a thrown error is retryable. Default: all. */
  readonly isRetryable?: (err: unknown) => boolean;
  /** AbortSignal for cooperative cancellation. */
  readonly signal?: AbortSignal;
  /** Called before each backoff sleep, for observability. */
  readonly onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
  /** Sleep hook for tests. */
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface DeadLetterRecord {
  readonly operation: string;
  readonly attempts: number;
  readonly lastError: string;
  readonly context: Record<string, unknown>;
  readonly failedAt: string;
}

export type DeadLetterSink = (record: DeadLetterRecord) => void | Promise<void>;

export class RetryExhaustedError extends Error {
  readonly attempts: number;
  readonly lastError: unknown;
  constructor(message: string, attempts: number, lastError: unknown) {
    super(message);
    this.name = "RetryExhaustedError";
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => { const t = setTimeout(resolve, ms); t.unref?.(); });

function defaultIsRetryable(): boolean { return true; }

/**
 * Retry an async operation with bounded exponential backoff. If
 * retries are exhausted, the last error is re-thrown wrapped in
 * RetryExhaustedError. The deadLetterSink is invoked exactly once
 * when retries are exhausted, with a structured record.
 */
export async function retryWithBackoff<T>(
  operation: string,
  fn: () => Promise<T>,
  options: RetryOptions = {},
  deadLetterSink: DeadLetterSink = () => undefined,
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  if (maxAttempts < 1) throw new Error(RETRY_ERROR_CODES.NEGATIVE_ATTEMPTS);
  const initial = options.initialBackoffMs ?? 100;
  const cap = options.maxBackoffMs ?? 5000;
  const mult = options.backoffMultiplier ?? 2;
  const jitter = options.jitter ?? 0.1;
  const isRetryable = options.isRetryable ?? defaultIsRetryable;
  const sleep = options.sleep ?? defaultSleep;
  const context: Record<string, unknown> = { operation };

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (options.signal?.aborted) {
      throw new Error("ingestion-retry-aborted");
    }
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === maxAttempts) {
        if (attempt === maxAttempts) {
          await deadLetterSink({
            operation,
            attempts: attempt,
            lastError: err instanceof Error ? err.message : String(err),
            context,
            failedAt: new Date().toISOString(),
          });
          throw new RetryExhaustedError(
            `${RETRY_ERROR_CODES.EXHAUSTED}:${operation}`,
            attempt,
            err,
          );
        }
        throw err;
      }
      const base = Math.min(cap, initial * Math.pow(mult, attempt - 1));
      const jitterMs = base * jitter * Math.random();
      const delayMs = Math.round(base + jitterMs);
      options.onRetry?.({ attempt, delayMs, error: err });
      await sleep(delayMs);
    }
  }
  // Unreachable; loop always returns or throws.
  throw lastErr;
}