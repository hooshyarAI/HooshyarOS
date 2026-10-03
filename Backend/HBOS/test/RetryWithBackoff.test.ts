/**
 * Stage 08-AUTO.3 — Retry / Error Recovery tests.
 */
import {
  RETRY_ERROR_CODES,
  RetryExhaustedError,
  retryWithBackoff,
} from "../Product/RetryWithBackoff";

describe("RetryWithBackoff (Stage 08-AUTO.3)", () => {
  test("returns immediately on success", async () => {
    let calls = 0;
    const result = await retryWithBackoff("op", async () => { calls += 1; return 42; });
    expect(result).toBe(42);
    expect(calls).toBe(1);
  });

  test("retries on failure then succeeds", async () => {
    let calls = 0;
    const result = await retryWithBackoff("op", async () => {
      calls += 1;
      if (calls < 3) throw new Error("transient");
      return "ok";
    }, { initialBackoffMs: 1, maxBackoffMs: 2, backoffMultiplier: 1, jitter: 0, sleep: async () => undefined });
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  test("throws RetryExhaustedError after maxAttempts", async () => {
    let calls = 0;
    const dl: unknown[] = [];
    await expect(retryWithBackoff("op", async () => {
      calls += 1;
      throw new Error("boom");
    }, {
      maxAttempts: 3, initialBackoffMs: 1, maxBackoffMs: 2, backoffMultiplier: 1, jitter: 0, sleep: async () => undefined,
    }, async (rec) => { dl.push(rec); })).rejects.toBeInstanceOf(RetryExhaustedError);
    expect(calls).toBe(3);
    expect(dl).toHaveLength(1);
    expect((dl[0] as { operation: string; attempts: number }).attempts).toBe(3);
  });

  test("non-retryable error fails fast and skips dead-letter", async () => {
    let calls = 0;
    const dl: unknown[] = [];
    await expect(retryWithBackoff("op", async () => {
      calls += 1;
      throw new Error("fatal");
    }, {
      maxAttempts: 5, isRetryable: () => false, sleep: async () => undefined,
    }, async (rec) => { dl.push(rec); })).rejects.toThrow("fatal");
    expect(calls).toBe(1);
    expect(dl).toHaveLength(0);
  });

  test("rejects maxAttempts < 1", async () => {
    await expect(retryWithBackoff("op", async () => 0, { maxAttempts: 0 }))
      .rejects.toThrow(RETRY_ERROR_CODES.NEGATIVE_ATTEMPTS);
  });

  test("honors AbortSignal", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(retryWithBackoff("op", async () => 0, { signal: ctrl.signal, maxAttempts: 3 }))
      .rejects.toThrow(/aborted/);
  });

  test("onRetry hook receives attempt + delay", async () => {
    const seen: number[] = [];
    let calls = 0;
    await expect(retryWithBackoff("op", async () => {
      calls += 1;
      throw new Error("x");
    }, {
      maxAttempts: 3, initialBackoffMs: 1, maxBackoffMs: 2, backoffMultiplier: 1, jitter: 0,
      sleep: async () => undefined, onRetry: ({ attempt }) => { seen.push(attempt); },
    })).rejects.toBeInstanceOf(RetryExhaustedError);
    expect(seen).toEqual([1, 2]);
    expect(calls).toBe(3);
  });
});