import { Server } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const request = async (server: Server, path: string, options: RequestInit = {}) => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server-not-listening");
  return fetch(`http://127.0.0.1:${address.port}${path}`, options);
};

describe("Executive Intelligence Workbench runtime integration", () => {
  let server: Server;

  beforeEach(async () => {
    server = createCommercialRuntimeServer({ databasePath: ":memory:" });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test("executes session -> analysis -> executive workbench -> dashboard", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "مدیرعامل", organization: "شرکت نمونه" }),
    });
    expect(session.status).toBe(201);
    const cookie = session.headers.get("set-cookie");
    expect(cookie).toContain("hooshyar_session=");
    const sessionCookie = cookie!.split(";")[0];

    const csv = "date,account,debit,credit,currency\n2026-08-01,Expense,600,0,IRR\n2026-08-01,Sales,0,1000,IRR";
    const analysis = await request(server, "/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: sessionCookie },
      body: JSON.stringify({ csv, sourceName: "executive-ledger.csv", assets: 2000, liabilities: 500 }),
    });
    expect(analysis.status).toBe(200);

    const workbench = await request(server, "/api/executive/workbench", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: sessionCookie },
      body: JSON.stringify({ targets: { revenue: 900, profit: 350, profitMargin: 0.3, debtRatio: 0.4 } }),
    });
    expect(workbench.status).toBe(200);
    const result = await workbench.json() as { capabilityId: string; tenantId: string; status: string; kpis: unknown[]; recommendations: unknown[] };
    expect(result.status).toBe("READY");
    expect(result.capabilityId).toBe("product.executive-intelligence-workbench");
    expect(result.tenantId).toMatch(/^tenant:/);
    expect(result.kpis).toHaveLength(4);
    expect(result.recommendations).toHaveLength(4);

    const dashboard = await request(server, "/api/dashboard", { headers: { cookie: sessionCookie } });
    expect(dashboard.status).toBe(200);
    const dashboardPayload = await dashboard.json() as { executiveIntelligence: { capabilityId: string; tenantId: string } | null };
    expect(dashboardPayload.executiveIntelligence).toEqual(expect.objectContaining({
      capabilityId: "product.executive-intelligence-workbench",
      tenantId: result.tenantId,
    }));
  });

  test("does not invent executive targets", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "مدیر", organization: "شرکت نمونه" }),
    });
    const cookie = session.headers.get("set-cookie")!.split(";")[0];
    const response = await request(server, "/api/executive/workbench", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "EXECUTIVE_TARGETS_REQUIRED" });
  });

  test("requires authentication for executive workbench", async () => {
    const response = await request(server, "/api/executive/workbench", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targets: { revenue: 900, profit: 350, profitMargin: 0.3, debtRatio: 0.4 } }),
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "AUTHENTICATION_REQUIRED" });
  });
});
