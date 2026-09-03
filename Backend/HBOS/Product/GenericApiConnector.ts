/**
 * Stage 08-ENT.1 — Generic API Acquisition Contract.
 *
 * Supporting service under the canonical FinancialDataIngestionAdapter.
 * Defines the contract for connecting to a tenant's external API,
 * applying auth (abstract — concrete impls live in tenant-specific
 * adapters), pagination, rate limiting, retry, response validation,
 * and mapping back to the canonical transaction model.
 *
 * The default `GenericApiConnector.fetchPage` uses Node's built-in
 * `fetch` (Node 18+). Tests inject a `transport` so no real network
 * is exercised. The connector never logs secrets.
 *
 * This module is NOT a new Engine.
 */

export const API_ERROR_CODES = {
  ENDPOINT_REQUIRED: "ingestion-api-endpoint-required",
  RATE_LIMITED: "ingestion-api-rate-limited",
  AUTH_REQUIRED: "ingestion-api-auth-required",
  RESPONSE_INVALID: "ingestion-api-response-invalid",
  PAGINATION_FAILED: "ingestion-api-pagination-failed",
  SECRET_LEAK_BLOCKED: "ingestion-api-secret-leak-blocked",
} as const;

/** A token-bucket style limiter that exposes `acquire()`. */
export interface RateLimiter {
  acquire(): Promise<void>;
}

export class TokenBucketRateLimiter implements RateLimiter {
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private tokens: number;
  private lastRefill: number;
  private readonly now: () => number;

  constructor(params: { readonly capacity: number; readonly refillPerSecond: number; readonly now?: () => number }) {
    this.capacity = params.capacity;
    this.refillPerMs = params.refillPerSecond / 1000;
    this.tokens = params.capacity;
    this.lastRefill = (params.now ?? Date.now)();
    this.now = params.now ?? Date.now;
  }

  async acquire(): Promise<void> {
    while (true) {
      const t = this.now();
      const elapsed = t - this.lastRefill;
      if (elapsed > 0) {
        this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
        this.lastRefill = t;
      }
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const deficit = 1 - this.tokens;
      const wait = Math.max(1, Math.ceil(deficit / this.refillPerMs));
      await new Promise((r) => { const tm = setTimeout(r, wait); tm.unref?.(); });
    }
  }
}

/** Abstract auth strategy. Concrete impls live in tenant-specific code. */
export interface AuthStrategy {
  /** Return headers to attach to each request. MUST NOT contain secrets
   *  in a way that the connector would log them; the connector only
   *  references the returned record opaquely. */
  headers(): Promise<Record<string, string>>;
}

export interface GenericApiConnectorConfig {
  readonly endpoint: string;
  readonly auth: AuthStrategy;
  readonly rateLimiter?: RateLimiter;
  readonly pageSize?: number;
  readonly maxPages?: number;
  /** Validate + map a single page. */
  readonly validateAndMap: (rawJson: unknown) => ReadonlyArray<Record<string, unknown>>;
  /** Transport injected for tests. */
  readonly transport?: ApiTransport;
  /** Optional logger; never receives secret values. */
  readonly logger?: { info: (msg: string) => void; warn: (msg: string) => void };
}

export interface ApiResponse {
  readonly status: number;
  readonly json: unknown;
  readonly headers: Readonly<Record<string, string>>;
}

export interface ApiTransport {
  fetch(url: string, init: { method: string; headers: Record<string, string> }): Promise<ApiResponse>;
}

const defaultTransport: ApiTransport = {
  async fetch(url, init) {
    const res = await fetch(url, { method: init.method, headers: init.headers });
    const json = await res.json().catch(() => null);
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    return { status: res.status, json, headers };
  },
};

export interface GenericApiFetchResult {
  readonly pages: number;
  readonly rows: ReadonlyArray<Record<string, unknown>>;
}

function redactHeaders(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(h)) {
    const lower = k.toLowerCase();
    if (lower.includes("auth") || lower.includes("token") || lower.includes("key") || lower.includes("secret")) {
      out[k] = "<redacted>";
    } else {
      out[k] = h[k];
    }
  }
  return out;
}

export class GenericApiConnector {
  private readonly cfg: GenericApiConnectorConfig;
  constructor(cfg: GenericApiConnectorConfig) {
    if (!cfg.endpoint?.trim()) throw new Error(API_ERROR_CODES.ENDPOINT_REQUIRED);
    if (!cfg.auth) throw new Error(API_ERROR_CODES.AUTH_REQUIRED);
    if (typeof cfg.validateAndMap !== "function") {
      throw new Error(API_ERROR_CODES.RESPONSE_INVALID);
    }
    this.cfg = cfg;
  }

  get endpoint(): string { return this.cfg.endpoint; }

  /** Build safe headers. The connector never logs the raw value of
   *  any header whose name contains auth/token/key/secret. */
  private async safeHeaders(): Promise<Record<string, string>> {
    const h = await this.cfg.auth.headers();
    return h;
  }

  /** Fetch a single page; used by tests and by `fetchAll`. */
  async fetchPage(cursor: string | null): Promise<{ rows: ReadonlyArray<Record<string, unknown>>; nextCursor: string | null }> {
    const url = new URL(this.cfg.endpoint);
    if (this.cfg.pageSize) url.searchParams.set("page_size", String(this.cfg.pageSize));
    if (cursor) url.searchParams.set("cursor", cursor);
    if (this.cfg.rateLimiter) await this.cfg.rateLimiter.acquire();
    const headers = await this.safeHeaders();
    const transport = this.cfg.transport ?? defaultTransport;
    const res = await transport.fetch(url.toString(), { method: "GET", headers });
    if (res.status === 429) {
      throw new Error(API_ERROR_CODES.RATE_LIMITED);
    }
    if (res.status < 200 || res.status >= 300) {
      this.cfg.logger?.warn(`api.fetch non-2xx status=${res.status} headers=${JSON.stringify(redactHeaders(headers))}`);
      throw new Error(`${API_ERROR_CODES.PAGINATION_FAILED}:status:${res.status}`);
    }
    const nextCursor = (res.headers["x-next-cursor"] ?? null) as string | null;
    const rows = this.cfg.validateAndMap(res.json);
    return { rows, nextCursor };
  }

  /** Walk pages until either a null nextCursor or maxPages reached. */
  async fetchAll(): Promise<GenericApiFetchResult> {
    const rows: Record<string, unknown>[] = [];
    let cursor: string | null = null;
    let pages = 0;
    const max = this.cfg.maxPages ?? 1000;
    while (pages < max) {
      const page = await this.fetchPage(cursor);
      rows.push(...page.rows);
      pages += 1;
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    return { pages, rows };
  }
}