/**
 * Runtime observability — additive request correlation and operation metrics.
 *
 * Supporting (non-Engine) service for the commercial runtime. It provides:
 *   - a per-request correlation id (returned as `X-Request-Id`)
 *   - bounded operation counters (requests/errors/duration) per normalized route
 *   - a snapshot consumed by the authenticated diagnostics endpoint
 *
 * It deliberately stores only non-sensitive fields (method, normalized route,
 * status code, duration) so no credential, cookie, tenant content or source
 * data can leak through the metrics surface.
 *
 * This module is NOT a new Engine and does not alter any frozen contract.
 */

export interface RouteMetric {
  readonly method: string;
  readonly route: string;
  readonly requests: number;
  readonly errors: number;
  readonly totalDurationMs: number;
}

export interface ObservabilitySnapshot {
  readonly generatedAt: string;
  readonly uptimeMs: number;
  readonly requests: number;
  readonly errors: number;
  readonly statusCounts: Readonly<Record<string, number>>;
  readonly routes: readonly RouteMetric[];
}

const ID_SEGMENT = /^(?:[0-9a-f]{8,}|[0-9a-f]{8}-[0-9a-f-]{4,}|\d+)$/i;

/** Collapse identifier-like path segments so cardinality stays bounded. */
export function normalizeRoute(path: string): string {
  const clean = (path.split("?")[0] ?? "/").trim() || "/";
  return clean
    .split("/")
    .map((segment) => (ID_SEGMENT.test(segment) ? ":id" : segment))
    .join("/");
}

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,64}$/;

export class RuntimeObservability {
  private readonly startedAtMs: number;
  private readonly now: () => number;
  private readonly routes = new Map<string, { requests: number; errors: number; totalDurationMs: number }>();
  private readonly statusCounts = new Map<number, number>();
  private requestTotal = 0;
  private errorTotal = 0;
  private requestSequence = 0;

  constructor(params: { readonly now?: () => number; readonly startedAtMs?: number } = {}) {
    this.now = params.now ?? Date.now;
    this.startedAtMs = params.startedAtMs ?? this.now();
  }

  /**
   * Resolve the correlation id for a request: reuse a caller-supplied
   * `X-Request-Id` when it is safe, otherwise mint one. Never reflects
   * arbitrary input into response headers.
   */
  requestId(inbound?: string | readonly string[]): string {
    const candidate = Array.isArray(inbound) ? inbound[0] : inbound;
    if (typeof candidate === "string" && SAFE_REQUEST_ID.test(candidate)) return candidate;
    this.requestSequence += 1;
    return `req-${this.startedAtMs.toString(36)}-${this.requestSequence.toString(36)}`;
  }

  /** Record a completed request. Only bounded, non-sensitive fields are kept. */
  recordRequest(method: string, path: string, status: number, durationMs: number): void {
    const route = normalizeRoute(path);
    const key = `${method.toUpperCase()} ${route}`;
    const entry = this.routes.get(key) ?? { requests: 0, errors: 0, totalDurationMs: 0 };
    entry.requests += 1;
    if (status >= 400) entry.errors += 1;
    entry.totalDurationMs += Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
    this.routes.set(key, entry);
    this.requestTotal += 1;
    if (status >= 400) this.errorTotal += 1;
    this.statusCounts.set(status, (this.statusCounts.get(status) ?? 0) + 1);
  }

  snapshot(): ObservabilitySnapshot {
    const routes: RouteMetric[] = [...this.routes.entries()]
      .map(([key, value]) => {
        const separator = key.indexOf(" ");
        return {
          method: key.slice(0, separator),
          route: key.slice(separator + 1),
          requests: value.requests,
          errors: value.errors,
          totalDurationMs: value.totalDurationMs,
        };
      })
      .sort((a, b) => (b.requests - a.requests) || a.route.localeCompare(b.route));
    const statusCounts: Record<string, number> = {};
    for (const [status, count] of [...this.statusCounts.entries()].sort((a, b) => a[0] - b[0])) {
      statusCounts[String(status)] = count;
    }
    return {
      generatedAt: new Date(this.now()).toISOString(),
      uptimeMs: Math.max(0, this.now() - this.startedAtMs),
      requests: this.requestTotal,
      errors: this.errorTotal,
      statusCounts,
      routes,
    };
  }
}
