import { Server } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";
import { normalizeRoute, RuntimeObservability } from "../Autonomous/Runtime/RuntimeObservability";

const listen = (server: ReturnType<typeof createCommercialRuntimeServer>) => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const close = (server: ReturnType<typeof createCommercialRuntimeServer>) => new Promise<void>((resolve) => server.close(() => resolve()));
const addressOf = (server: Server) => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server-not-listening");
  return `http://127.0.0.1:${address.port}`;
};
const cookieFrom = (response: Response): string => {
  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error("session-cookie-missing");
  return cookie.split(";")[0];
};

describe("RuntimeObservability", () => {
  test("normalizes identifier-like route segments and strips query strings", () => {
    expect(normalizeRoute("/api/execution/work-items/deadbeefcafe")).toBe("/api/execution/work-items/:id");
    expect(normalizeRoute("/api/sources/deadbeef00112233")).toBe("/api/sources/:id");
    expect(normalizeRoute("/api/report/artifacts/deadbeefcafe/download")).toBe("/api/report/artifacts/:id/download");
    expect(normalizeRoute("/api/auth/login?password=hunter2")).toBe("/api/auth/login");
    expect(normalizeRoute("/health")).toBe("/health");
  });

  test("accepts safe inbound request ids and never reflects unsafe input", () => {
    const observability = new RuntimeObservability({ now: () => 0, startedAtMs: 0 });
    expect(observability.requestId("corr-123_ABC.def")).toBe("corr-123_ABC.def");
    expect(observability.requestId("bad\r\nInjected: 1")).toMatch(/^req-/);
    expect(observability.requestId("<script>alert(1)</script>")).toMatch(/^req-/);
    expect(observability.requestId(undefined)).toMatch(/^req-/);
  });

  test("counts requests, errors, status codes and duration with bounded fields", () => {
    const observability = new RuntimeObservability({ now: () => 0, startedAtMs: 0 });
    observability.recordRequest("GET", "/api/dashboard", 200, 12);
    observability.recordRequest("GET", "/api/dashboard", 500, 8);
    observability.recordRequest("POST", "/api/analyze/deadbeef", 200, 5);

    const snapshot = observability.snapshot();
    expect(snapshot.requests).toBe(3);
    expect(snapshot.errors).toBe(1);
    expect(snapshot.statusCounts["200"]).toBe(2);
    expect(snapshot.statusCounts["500"]).toBe(1);
    expect(snapshot.routes.find((route) => route.route === "/api/dashboard")).toMatchObject({
      method: "GET",
      requests: 2,
      errors: 1,
      totalDurationMs: 20,
    });
    expect(snapshot.routes.some((route) => route.route === "/api/analyze/:id")).toBe(true);
    // No sensitive material is retained anywhere in the snapshot.
    expect(JSON.stringify(snapshot)).not.toMatch(/password|cookie|secret|token/i);
  });
});

describe("CommercialRuntimeServer request observability", () => {
  let server: Server;

  const start = async () => {
    server = createCommercialRuntimeServer({
      databasePath: ":memory:",
      now: () => 1_700_000_000_000,
      reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true }) },
    });
    await listen(server);
  };

  const post = (path: string, body: unknown, cookie?: string) => fetch(`${addressOf(server)}${path}`, {
    method: "POST",
    headers: cookie ? { "content-type": "application/json", cookie } : { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  afterEach(async () => {
    if (server?.listening) await close(server);
  });

  test("emits a correlation id and records real operation metrics", async () => {
    await start();
    const registered = await post("/api/auth/register", { username: "obs-owner", organization: "ObsCo", password: "Sup3rSecret!" });
    const cookie = cookieFrom(registered);

    const ready = await fetch(`${addressOf(server)}/api/ready`);
    expect(ready.status).toBe(200);
    expect(ready.headers.get("x-request-id")).toBeTruthy();

    const missing = await fetch(`${addressOf(server)}/api/does-not-exist`, { headers: { cookie } });
    expect(missing.status).toBe(404);
    const missingBody = await missing.json() as { error: string; requestId: string };
    expect(missingBody.error).toBe("NOT_FOUND");
    expect(missingBody.requestId).toBeTruthy();

    const echoed = await fetch(`${addressOf(server)}/health`, { headers: { "x-request-id": "corr-123" } });
    expect(echoed.headers.get("x-request-id")).toBe("corr-123");

    const metrics = await fetch(`${addressOf(server)}/api/diagnostics/metrics`, { headers: { cookie } });
    expect(metrics.status).toBe(200);
    const body = await metrics.json() as {
      requests: number;
      errors: number;
      statusCounts: Record<string, number>;
      routes: Array<{ method: string; route: string; requests: number; errors: number; totalDurationMs: number }>;
    };
    expect(body.requests).toBeGreaterThanOrEqual(3);
    expect(body.errors).toBeGreaterThanOrEqual(1);
    expect(body.statusCounts["404"]).toBeGreaterThanOrEqual(1);
    const healthRoute = body.routes.find((route) => route.route === "/health");
    expect(healthRoute).toBeTruthy();
    expect(healthRoute!.requests).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(body)).not.toMatch(/password|cookie|secret/i);
  }, 20_000);

  test("restricts metrics to privileged roles and fails closed", async () => {
    await start();
    const anonymous = await fetch(`${addressOf(server)}/api/diagnostics/metrics`);
    expect(anonymous.status).toBe(401);

    const owner = await post("/api/auth/register", { username: "metrics-owner", organization: "MetricsCo", password: "Sup3rSecret!" });
    const ownerCookie = cookieFrom(owner);
    const viewer = await post("/api/auth/register", { username: "metrics-viewer", organization: "MetricsCo", password: "Sup3rSecret!" });
    const viewerCookie = cookieFrom(viewer);

    const ownerMetrics = await fetch(`${addressOf(server)}/api/diagnostics/metrics`, { headers: { cookie: ownerCookie } });
    expect(ownerMetrics.status).toBe(200);

    const viewerMetrics = await fetch(`${addressOf(server)}/api/diagnostics/metrics`, { headers: { cookie: viewerCookie } });
    expect(viewerMetrics.status).toBe(403);
    expect(await viewerMetrics.json()).toEqual({ error: "INSUFFICIENT_PERMISSIONS" });
  }, 20_000);
});
