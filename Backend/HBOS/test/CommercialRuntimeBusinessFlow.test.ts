import { Server } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const request = async (server: Server, path: string, options: RequestInit = {}) => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server-not-listening");
  return fetch(`http://127.0.0.1:${address.port}${path}`, options);
};

describe("Commercial runtime real business flow", () => {
  let server: Server;

  beforeEach(async () => {
    server = createCommercialRuntimeServer({
      databasePath: ":memory:",
      reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true }) },
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test("executes session -> ingestion -> analysis -> tenant-scoped dashboard", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "مدیرعامل", organization: "شرکت نمونه" }),
    });
    expect(session.status).toBe(201);
    const cookie = session.headers.get("set-cookie");
    expect(cookie).toContain("hooshyar_session=");

    const csv = "date,account,debit,credit,currency\n2026-08-01,Cash,1000,0,IRR\n2026-08-01,Sales,0,1000,IRR";
    const analysis = await request(server, "/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookie!.split(";")[0] },
      body: JSON.stringify({ csv, sourceName: "ledger.csv", assets: 1000, liabilities: 250 }),
    });
    expect(analysis.status).toBe(200);
    const result = await analysis.json() as { status: string; tenantId: string; metrics: { profit: number; debtRatio: number }; source: { sha256: string } };
    expect(result.status).toBe("READY");
    expect(result.tenantId).toMatch(/^tenant:/);
    expect(result.metrics.profit).toBe(0);
    expect(result.metrics.debtRatio).toBe(0.25);
    expect(result.source.sha256).toMatch(/^[a-f0-9]{64}$/);

    const dashboard = await request(server, "/api/dashboard", { headers: { cookie: cookie!.split(";")[0] } });
    expect(dashboard.status).toBe(200);
    const dashboardPayload = await dashboard.json() as {
      analysisAvailable: boolean;
      metrics: { revenue: number; profit: number; risk: number };
      targetsConfigured: boolean;
      executiveEvaluation: unknown;
    };
    expect(dashboardPayload.analysisAvailable).toBe(true);
    expect(dashboardPayload.metrics).toEqual({ revenue: 1000, profit: 0, risk: 25 });
    expect(dashboardPayload.targetsConfigured).toBe(false);
    expect(dashboardPayload.executiveEvaluation).toBeNull();

    const targetsResponse = await request(server, "/api/executive-targets", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookie!.split(";")[0] },
      body: JSON.stringify({ targets: { revenue: 900, profit: 10, profitMargin: 0.1, debtRatio: 0.4 } }),
    });
    expect(targetsResponse.status).toBe(200);
    expect((await targetsResponse.json() as { saved: boolean }).saved).toBe(true);

    const evaluatedDashboard = await request(server, "/api/dashboard", { headers: { cookie: cookie!.split(";")[0] } });
    const evaluated = await evaluatedDashboard.json() as {
      targetsConfigured: boolean;
      targets: { debtRatio: number };
      executiveEvaluation: {
        kpis: Array<{ name: string; direction: string; achievementRate: number }>;
        recommendations: Array<{ status: string }>;
        performance: Array<{ status: string }>;
      };
    };
    expect(evaluated.targetsConfigured).toBe(true);
    expect(evaluated.targets.debtRatio).toBe(0.4);
    const debtIndex = evaluated.executiveEvaluation.kpis.findIndex((kpi) => kpi.name === "debtRatio");
    expect(evaluated.executiveEvaluation.kpis[debtIndex].direction).toBe("lower-is-better");
    expect(evaluated.executiveEvaluation.kpis[debtIndex].achievementRate).toBeGreaterThan(100);
    expect(evaluated.executiveEvaluation.recommendations[debtIndex].status).toBe("ON_TRACK");
    expect(evaluated.executiveEvaluation.performance[debtIndex].status).toBe("ON_TRACK");
  });

  test("persists analysis history per tenant and exposes it to the dashboard", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "مدیرعامل", organization: "شرکت الف" }),
    });
    const cookie = session.headers.get("set-cookie")!.split(";")[0];
    const csv = "date,account,debit,credit,currency\n2026-08-01,Cash,1000,0,IRR\n2026-08-01,Sales,0,1000,IRR";
    for (let i = 0; i < 2; i += 1) {
      const response = await request(server, "/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ csv, sourceName: "ledger-" + i + ".csv", assets: 1000, liabilities: 250 }),
      });
      expect(response.status).toBe(200);
    }
    await request(server, "/api/executive-targets", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ targets: { revenue: 900, profit: 100, profitMargin: 0.15, debtRatio: 0.4 } }),
    });
    const dashboard = await request(server, "/api/dashboard", { headers: { cookie } });
    const payload = await dashboard.json() as { history: Array<{ analyzedAt: string; source: { sourceName: string } }> };
    expect(payload.history).toHaveLength(2);
    expect(payload.history[0].analyzedAt).toBeTruthy();
    expect(payload.history.map((entry) => entry.source.sourceName)).toEqual(["ledger-0.csv", "ledger-1.csv"]);

    const otherSession = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "مدیرعامل", organization: "شرکت ب" }),
    });
    const otherCookie = otherSession.headers.get("set-cookie")!.split(";")[0];
    const otherDashboard = await request(server, "/api/dashboard", { headers: { cookie: otherCookie } });
    const otherPayload = await otherDashboard.json() as {
      analysisAvailable: boolean;
      history: unknown[];
      targetsConfigured: boolean;
      targets: unknown;
      executiveEvaluation: unknown;
    };
    expect(otherPayload.analysisAvailable).toBe(false);
    expect(otherPayload.history).toEqual([]);
    expect(otherPayload.targetsConfigured).toBe(false);
    expect(otherPayload.targets).toBeNull();
    expect(otherPayload.executiveEvaluation).toBeNull();
  });

  test("rejects incomplete or non-positive executive targets", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "مدیرعامل", organization: "شرکت هدف‌ها" }),
    });
    const cookie = session.headers.get("set-cookie")!.split(";")[0];
    const response = await request(server, "/api/executive-targets", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ targets: { revenue: 100, profit: 20, profitMargin: 0.1, debtRatio: 0 } }),
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "EXECUTIVE_TARGETS_INVALID" });
  });

  test("fails closed without a session", async () => {
    const response = await request(server, "/api/analyze", { method: "POST", body: "{}" });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "AUTHENTICATION_REQUIRED" });
  });
});
