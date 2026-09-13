import { Server } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const request = async (server: Server, path: string, options: RequestInit = {}) => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server-not-listening");
  return fetch(`http://127.0.0.1:${address.port}${path}`, options);
};

describe("CommercialRuntimeServer resilience and impact endpoints", () => {
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

  test("POST /api/resilience/stress-test returns deterministic bounds without residuals", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "user1", organization: "org1" }),
    });
    expect(session.status).toBe(201);
    const cookie = session.headers.get("set-cookie");

    const response = await request(server, "/api/resilience/stress-test", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookie!.split(";")[0] },
      body: JSON.stringify({
        metric: "revenue",
        baseValue: 1000,
        scenarios: [
          { name: "recession", description: "Recession", shockPercent: -20, appliedAt: 1 }
        ]
      }),
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.status).toBe("READY");
    expect(payload.mode).toBe("deterministic_bounds");
    expect(payload.scenarioBounds).toHaveLength(1);
    expect(payload.scenarioBounds[0].bound).toBeCloseTo(800, 5);
    expect(payload.tenantId).toMatch(/^tenant:/);
  });

  test("POST /api/resilience/stress-test returns 422 for invalid input", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "user1", organization: "org1" }),
    });
    expect(session.status).toBe(201);
    const cookie = session.headers.get("set-cookie");

    const response = await request(server, "/api/resilience/stress-test", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookie!.split(";")[0] },
      body: JSON.stringify({ metric: "", baseValue: 1000, scenarios: [] }),
    });
    expect(response.status).toBe(422);
    const payload = await response.json();
    expect(payload.status).toBe("BLOCKED");
  });

  test("POST /api/resilience/sensitivity returns elasticity results", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "user1", organization: "org1" }),
    });
    expect(session.status).toBe(201);
    const cookie = session.headers.get("set-cookie");

    const response = await request(server, "/api/resilience/sensitivity", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookie!.split(";")[0] },
      body: JSON.stringify({ metric: "margin", baseValue: 1000, shockRange: [-20, 0, 20] }),
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.shockedValues).toHaveLength(3);
    expect(payload.elasticities).toHaveLength(3);
  });

  test("POST /api/resilience/optimize returns feasible solution", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "user1", organization: "org1" }),
    });
    expect(session.status).toBe(201);
    const cookie = session.headers.get("set-cookie");

    const response = await request(server, "/api/resilience/optimize", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookie!.split(";")[0] },
      body: JSON.stringify({
        objective: "maximize_profit",
        variableNames: ["units"],
        initialGuess: [5],
        bounds: [{ variable: "units", lower: 0, upper: 10 }]
      }),
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.status).toBe("READY");
    expect(payload.solution.units).toBeCloseTo(10, 1);
  });

  test("POST /api/impact/measure returns impact measurement", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "user1", organization: "org1" }),
    });
    expect(session.status).toBe(201);
    const cookie = session.headers.get("set-cookie");

    const response = await request(server, "/api/impact/measure", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookie!.split(";")[0] },
      body: JSON.stringify({
        baseline: {
          revenue: 1000, profit: 200, profitMargin: 0.2, debtRatio: 0.3,
          cycleTime: 10, throughput: 50, errorRate: 0.05, capacity: 100,
          operatingCost: 500, decisionLatency: 2, riskScore: 0.1,
          recordedAt: "2026-01-01T00:00:00Z"
        },
        post: {
          revenue: 1200, profit: 300, profitMargin: 0.25, debtRatio: 0.25,
          cycleTime: 8, throughput: 60, errorRate: 0.03, capacity: 120,
          operatingCost: 450, decisionLatency: 1.5, riskScore: 0.08,
          recordedAt: "2026-02-01T00:00:00Z"
        }
      }),
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.status).toBe("READY");
    expect(payload.deltas.revenue).toBe(200);
    expect(payload.actualImpact.timeSaved).toBe(2);
  });

  test("POST /api/impact/measure returns 400 for missing baseline or post", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "user1", organization: "org1" }),
    });
    expect(session.status).toBe(201);
    const cookie = session.headers.get("set-cookie");

    const response = await request(server, "/api/impact/measure", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookie!.split(";")[0] },
      body: JSON.stringify({ baseline: {} }),
    });
    expect(response.status).toBe(400);
  });

  test("POST /api/improvement/improve returns adaptation recommendations", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "user1", organization: "org1" }),
    });
    expect(session.status).toBe(201);
    const cookie = session.headers.get("set-cookie");

    const response = await request(server, "/api/improvement/improve", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookie!.split(";")[0] },
      body: JSON.stringify({
        domain: "financial",
        actualImpact: {
          timeSaved: 2,
          operatingCostReduced: 50,
          actualFinancialValue: 100,
          actualROI: 0.1,
          sustainability: "NOT_SUSTAINABLE"
        },
        currentState: {
          revenue: 5000,
          profit: 1000,
          riskScore: 0.5,
          decisionLatency: 10
        }
      }),
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.status).toBe("READY");
    expect(payload.recommendations.length).toBeGreaterThan(0);
  });

  test("resilience and impact endpoints require authentication", async () => {
    const response = await request(server, "/api/resilience/stress-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ metric: "revenue", baseValue: 1000, scenarios: [] }),
    });
    expect(response.status).toBe(401);
  });
});

