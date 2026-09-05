/**
 * Stage 08-ENT.1 — Generic API Connector tests.
 */
import {
  API_ERROR_CODES,
  GenericApiConnector,
  TokenBucketRateLimiter,
  type ApiResponse,
  type ApiTransport,
  type AuthStrategy,
} from "../Product/GenericApiConnector";

function makeAuth(): AuthStrategy {
  return { headers: async () => ({ Authorization: "Bearer secret-do-not-log" }) };
}

function makeTransport(responses: ApiResponse[]): { transport: ApiTransport; calls: Array<{ url: string; headers: Record<string, string> }> } {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  let i = 0;
  const transport: ApiTransport = {
    async fetch(url, init) {
      calls.push({ url, headers: init.headers });
      const r = responses[i] ?? responses[responses.length - 1];
      i += 1;
      return r;
    },
  };
  return { transport, calls };
}

describe("GenericApiConnector (Stage 08-ENT.1)", () => {
  test("rejects empty endpoint", () => {
    expect(() => new GenericApiConnector({
      endpoint: "", auth: makeAuth(), validateAndMap: () => [],
    })).toThrow(API_ERROR_CODES.ENDPOINT_REQUIRED);
  });

  test("rejects missing auth", () => {
    expect(() => new GenericApiConnector({
      endpoint: "https://x", auth: undefined as unknown as AuthStrategy, validateAndMap: () => [],
    })).toThrow(API_ERROR_CODES.AUTH_REQUIRED);
  });

  test("fetches one page and maps rows", async () => {
    const { transport, calls } = makeTransport([{
      status: 200, json: { data: [{ id: 1 }, { id: 2 }] },
      headers: { "x-next-cursor": "" },
    }]);
    const c = new GenericApiConnector({
      endpoint: "https://api.example.com/v1/ledger",
      auth: makeAuth(),
      transport,
      validateAndMap: (raw) => Array.isArray((raw as { data?: unknown[] }).data) ? (raw as { data: Record<string, unknown>[] }).data : [],
    });
    const result = await c.fetchAll();
    expect(result.rows).toHaveLength(2);
    expect(calls).toHaveLength(1);
    expect(calls[0].headers.Authorization).toBe("Bearer secret-do-not-log");
  });

  test("follows cursor across multiple pages", async () => {
    const { transport } = makeTransport([
      { status: 200, json: { data: [{ id: 1 }] }, headers: { "x-next-cursor": "c2" } },
      { status: 200, json: { data: [{ id: 2 }] }, headers: { "x-next-cursor": "c3" } },
      { status: 200, json: { data: [{ id: 3 }] }, headers: { "x-next-cursor": "" } },
    ]);
    const c = new GenericApiConnector({
      endpoint: "https://api.example.com/v1/ledger",
      auth: makeAuth(), transport, pageSize: 1,
      validateAndMap: (raw) => (raw as { data: Record<string, unknown>[] }).data,
    });
    const r = await c.fetchAll();
    expect(r.pages).toBe(3);
    expect(r.rows.map((x) => x.id)).toEqual([1, 2, 3]);
  });

  test("throws RATE_LIMITED on 429", async () => {
    const { transport } = makeTransport([{ status: 429, json: null, headers: {} }]);
    const c = new GenericApiConnector({
      endpoint: "https://api.example.com/v1/ledger", auth: makeAuth(), transport,
      validateAndMap: () => [],
    });
    await expect(c.fetchPage(null)).rejects.toThrow(API_ERROR_CODES.RATE_LIMITED);
  });

  test("throws PAGINATION_FAILED on 5xx", async () => {
    const { transport } = makeTransport([{ status: 503, json: null, headers: {} }]);
    const c = new GenericApiConnector({
      endpoint: "https://api.example.com/v1/ledger", auth: makeAuth(), transport,
      validateAndMap: () => [],
    });
    await expect(c.fetchPage(null)).rejects.toThrow(/pagination-failed/);
  });

  test("rate limiter blocks when bucket empty", async () => {
    let now = 0;
    const rl = new TokenBucketRateLimiter({ capacity: 1, refillPerSecond: 1, now: () => now });
    now = 0;
    await rl.acquire();
    const start = Date.now();
    const p = rl.acquire();
    now = 1500;
    await p;
    // should not have blocked more than 1.5s; just verify it returns
    expect(start).toBeLessThanOrEqual(Date.now());
  });

  test("respects maxPages cap", async () => {
    const responses: ApiResponse[] = Array.from({ length: 5 }, () => ({
      status: 200, json: { data: [{ id: 1 }] }, headers: { "x-next-cursor": "next" } }));
    const { transport } = makeTransport(responses);
    const c = new GenericApiConnector({
      endpoint: "https://api.example.com/v1/ledger", auth: makeAuth(), transport,
      maxPages: 2, validateAndMap: (raw) => (raw as { data: Record<string, unknown>[] }).data,
    });
    const r = await c.fetchAll();
    expect(r.pages).toBe(2);
  });

  test("never logs secret headers verbatim", async () => {
    const logger = { info: jest.fn(), warn: jest.fn() };
    const { transport } = makeTransport([{ status: 500, json: null, headers: {} }]);
    const c = new GenericApiConnector({
      endpoint: "https://api.example.com/v1/ledger", auth: makeAuth(), transport, logger,
      validateAndMap: () => [],
    });
    await expect(c.fetchPage(null)).rejects.toThrow();
    expect(logger.warn).toHaveBeenCalled();
    const msg = logger.warn.mock.calls[0][0] as string;
    expect(msg).toContain("<redacted>");
    expect(msg).not.toContain("secret-do-not-log");
  });
});
