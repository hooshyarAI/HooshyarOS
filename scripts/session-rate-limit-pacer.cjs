/**
 * Client-side mirror of the canonical runtime per-session token bucket.
 *
 * The commercial runtime (`CommercialRuntimeServer`) protects every mutating
 * session-scoped API route with ONE per-session token bucket:
 * `capacity = 5`, `refillPerSecond = 1`. Any client that issues more than five
 * session-limited requests inside a second is correctly rejected with HTTP 429
 * `RATE_LIMIT_EXCEEDED`.
 *
 * The executable web acceptance harness is a QA client and must never exceed
 * that documented contract. Relying on incidental request latency (slower
 * local I/O) to stay under the bucket made acceptance machine-dependent: on a
 * fast CI runner the initial ingestion sequence drained the bucket and the
 * sixth call (the XLSX ingest) was legitimately rate-limited. This pacer
 * mirrors the production bucket exactly so acceptance timing is deterministic
 * on every machine, without weakening the production rate limit.
 *
 * This is NOT an engine and NOT a second rate limiter: it is a test-client
 * mirror whose only purpose is to keep the acceptance harness honest about the
 * frozen runtime contract.
 */

const SESSION_RATE_LIMIT_CAPACITY = 5;
const SESSION_RATE_LIMIT_REFILL_PER_SECOND = 1;

/**
 * Safety cushion applied to a computed refill wait.
 *
 * The mirror runs in a different process than the authoritative bucket, so its
 * measured elapsed time can exceed the server's by scheduling jitter (and the
 * server only needs to observe marginally under one token to answer 429 — the
 * comparison is `tokens >= 1` in floating point). Waiting the exact refill
 * window leaves zero surplus and is therefore not safe: a deterministic drift
 * probe (pacer clock 2% fast) reproduces the real
 * `WEB_ACCEPTANCE_XLSX_INGEST_FAILED:429`. A 10% cushion is the same margin the
 * harness already applied by hand (`sleep(1100)` for a 1000 ms window).
 *
 * The cushion is turned into a reserve token amount (below) and enforced on
 * EVERY admission, not only after an explicit sleep. Otherwise a token that was
 * replenished naturally by elapsed time is consumed down to zero, and the
 * authoritative server — which consumes it later, after request-dispatch
 * latency — can observe less than one full token when the previous request had
 * a larger dispatch latency than the current one, and answer 429.
 */
const SESSION_RATE_LIMIT_PACING_MARGIN_RATIO = 0.1;

/**
 * The exact set of session-rate-limited POST routes owned by
 * `CommercialRuntimeServer`. Kept method-aware: the same paths are NOT limited
 * for GET. Execution work-item sub-routes are matched by prefix below.
 */
const SESSION_RATE_LIMITED_POST_PATHS = new Set([
    "/api/analyze",
    "/api/financial/analyze",
    "/api/ingest",
    "/api/executive/workbench",
    "/api/decision/workbench",
    "/api/financial/insights",
    "/api/assistant",
    "/api/resilience/stress-test",
    "/api/resilience/sensitivity",
    "/api/resilience/optimize",
    "/api/impact/measure",
    "/api/improvement/improve",
]);

const EXECUTION_WORK_ITEMS = /^\/api\/execution\/work-items(\/|$)/;

/** True when the canonical runtime consumes a per-session token for this call. */
function isSessionRateLimitedPost(pathname, method) {
    if (String(method || "GET").toUpperCase() !== "POST") return false;
    if (SESSION_RATE_LIMITED_POST_PATHS.has(pathname)) return true;
    return EXECUTION_WORK_ITEMS.test(pathname);
}

/**
 * Deterministic client-side mirror of the canonical session bucket.
 *
 * `acquire()` resolves immediately while the mirrored bucket holds a token and
 * otherwise waits exactly as long as the production bucket needs to refill one
 * token. `now` and `sleep` are injectable so tests can drive it with a fake
 * clock instead of real time.
 */
function createSessionRateLimitPacer(options = {}) {
    const capacity = options.capacity ?? SESSION_RATE_LIMIT_CAPACITY;
    const refillPerSecond = options.refillPerSecond ?? SESSION_RATE_LIMIT_REFILL_PER_SECOND;
    const now = options.now ?? (() => Date.now());
    const sleep = options.sleep ?? ((ms) => new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        if (typeof timer.unref === "function") timer.unref();
    }));
    const refillPerMs = refillPerSecond / 1000;
    const refillWindowMs = 1000 / refillPerSecond;
    const marginMs = options.marginMs ?? Math.ceil(refillWindowMs * SESSION_RATE_LIMIT_PACING_MARGIN_RATIO);
    // Token-equivalent of the configured safety margin. A mirrored token count
    // of `1 + reserveTokens` already carries the full margin, so consuming one
    // token from that point leaves the reserve intact and the authoritative
    // bucket immune to the dispatch-lag skew that caused the 429.
    const reserveTokens = marginMs * refillPerMs;
    let tokens = capacity;
    let lastRefill = now();
    // The reserve is only meaningful once the mirror has actually credited
    // elapsed-time refill: the initial full bucket is a known-good mirror of the
    // freshly created server bucket, while every refill-derived token is an
    // estimate that can be optimistic under clock / dispatch-lag skew. This
    // keeps the legitimate initial burst of `capacity` intact and enforces the
    // reserve on naturally replenished tokens.
    let refillCredited = false;

    function refill() {
        const t = now();
        const elapsed = t - lastRefill;
        if (elapsed > 0) {
            const replenished = Math.min(capacity, tokens + elapsed * refillPerMs);
            if (replenished > tokens) refillCredited = true;
            tokens = replenished;
            lastRefill = t;
        }
    }

    async function acquire() {
        for (;;) {
            refill();
            // Admit only when the mirror holds enough tokens to consume one AND
            // still preserve the configured reserve; otherwise wait until the
            // reserve has refilled.
            const threshold = refillCredited ? 1 + reserveTokens : 1;
            if (tokens >= threshold) {
                tokens -= 1;
                return;
            }
            const deficit = threshold - tokens;
            await sleep(Math.max(1, Math.ceil(deficit / refillPerMs) + marginMs));
        }
    }

    return { acquire, capacity, refillPerSecond, marginMs, reserveTokens };
}

module.exports = {
    SESSION_RATE_LIMIT_CAPACITY,
    SESSION_RATE_LIMIT_REFILL_PER_SECOND,
    SESSION_RATE_LIMIT_PACING_MARGIN_RATIO,
    SESSION_RATE_LIMITED_POST_PATHS,
    isSessionRateLimitedPost,
    createSessionRateLimitPacer,
};
