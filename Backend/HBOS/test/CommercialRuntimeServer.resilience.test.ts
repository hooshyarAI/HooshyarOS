import { Server } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const request = async (server: Server, path: string, options: RequestInit = {}) => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server-not-listening");
  return fetch(`http://127.0.0.1:${address.port}${path}`, options);
};

describe("CommercialRuntimeServer resilience endpoints", () => {
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

  test("resilience endpoints require authentication", async () => {
    const response = await request(server, "/api/resilience/stress-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ metric: "revenue", baseValue: 1000, scenarios: [] }),
    });
    expect(response.status).toBe(401);
  });
});
