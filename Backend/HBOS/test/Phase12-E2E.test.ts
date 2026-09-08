import { Server } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const request = async (server: Server, path: string, options: RequestInit = {}) => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server-not-listening");
  return fetch(`http://127.0.0.1:${address.port}${path}`, options);
};

describe("Phase 12 E2E: resilience, impact, improvement", () => {
  let server: Server;

  beforeEach(async () => {
    server = createCommercialRuntimeServer({
      databasePath: ":memory:",
      reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true, answer: "verified" }) },
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test("full Phase 12 user journey: session -> analysis -> resilience -> impact -> improvement", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "manager", organization: "acme" }),
    });
    expect(session.status).toBe(201);
    const cookie = session.headers.get("set-cookie");
    const sessionJson = await session.json();
    const tenantId = sessionJson.tenantId;

    const csv = "date,account,debit,credit,currency\n2026-08-01,Cash,1000,0,IRR\n2026-08-01,Sales,0,1000,IRR";
    const analysis = await request(server, "/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookie!.split(";")[0] },
      body: JSON.stringify({ csv, sourceName: "ledger.csv", assets: 1000, liabilities: 250 }),
    });
    expect(analysis.status).toBe(200);
    const analysisJson = await analysis.json();
    expect(analysisJson.status).toBe("READY");
    expect(analysisJson.tenantId).toBe(tenantId);

    const resilience = await request(server, "/api/resilience/stress-test", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookie!.split(";")[0] },
      body: JSON.stringify({
        metric: "revenue",
        baseValue: analysisJson.metrics.revenue,
        scenarios: [{ name: "stress", description: "Stress", shockPercent: -10, appliedAt: 1 }]
      }),
    });
    expect(resilience.status).toBe(200);
    const resilienceJson = await resilience.json();
    expect(resilienceJson.status).toBe("READY");
    expect(resilienceJson.tenantId).toBe(tenantId);

    const impact = await request(server, "/api/impact/measure", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookie!.split(";")[0] },
      body: JSON.stringify({
        baseline: {
          revenue: analysisJson.metrics.revenue,
          profit: analysisJson.metrics.profit,
          profitMargin: analysisJson.metrics.profitMargin,
          debtRatio: analysisJson.metrics.debtRatio,
          cycleTime: 10,
          throughput: 50,
          errorRate: 0.05,
          capacity: 100,
          operatingCost: 500,
          decisionLatency: 2,
          riskScore: 0.1,
          recordedAt: "2026-01-01T00:00:00Z"
        },
        post: {
          revenue: analysisJson.metrics.revenue * 1.1,
          profit: analysisJson.metrics.profit * 1.2,
          profitMargin: analysisJson.metrics.profitMargin * 1.1,
          debtRatio: analysisJson.metrics.debtRatio * 0.9,
          cycleTime: 8,
          throughput: 60,
          errorRate: 0.03,
          capacity: 120,
          operatingCost: 450,
          decisionLatency: 1.5,
          riskScore: 0.08,
          recordedAt: "2026-02-01T00:00:00Z"
        }
      }),
    });
    expect(impact.status).toBe(200);
    const impactJson = await impact.json();
    expect(impactJson.status).toBe("READY");
    expect(impactJson.tenantId).toBe(tenantId);
    expect(impactJson.deltas.revenue).toBeGreaterThan(0);

    const improvement = await request(server, "/api/improvement/improve", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookie!.split(";")[0] },
      body: JSON.stringify({
        domain: "financial",
        actualImpact: {
          timeSaved: impactJson.actualImpact.timeSaved,
          operatingCostReduced: impactJson.actualImpact.operatingCostReduced,
          actualFinancialValue: impactJson.actualImpact.actualFinancialValue,
          actualROI: impactJson.actualImpact.actualROI,
          sustainability: impactJson.actualImpact.sustainability
        },
        currentState: {
          revenue: analysisJson.metrics.revenue,
          profit: analysisJson.metrics.profit,
          riskScore: 0.2,
          decisionLatency: 2
        }
      }),
    });
    expect(improvement.status).toBe(200);
    const improvementJson = await improvement.json();
    expect(improvementJson.status).toBe("READY");
    expect(improvementJson.tenantId).toBe(tenantId);
    expect(improvementJson.recommendations.length).toBeGreaterThan(0);

    const dashboard = await request(server, "/api/dashboard", {
      headers: { cookie: cookie!.split(";")[0] }
    });
    expect(dashboard.status).toBe(200);
    const dashboardJson = await dashboard.json();
    expect(dashboardJson.analysisAvailable).toBe(true);
    expect(dashboardJson.tenantId).toBe(tenantId);
  });

  test("Phase 12 endpoints fail closed without session", async () => {
    const resilience = await request(server, "/api/resilience/stress-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ metric: "revenue", baseValue: 1000, scenarios: [] }),
    });
    expect(resilience.status).toBe(401);

    const impact = await request(server, "/api/impact/measure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseline: {}, post: {} }),
    });
    expect(impact.status).toBe(401);

    const improvement = await request(server, "/api/improvement/improve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actualImpact: {}, currentState: {} }),
    });
    expect(improvement.status).toBe(401);
  });
});
