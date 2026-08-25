import { Server } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const request = async (server: Server, path: string, options: RequestInit = {}) => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server-not-listening");
  return fetch(`http://127.0.0.1:${address.port}${path}`, options);
};

const cookieFrom = (response: Response): string => {
  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error("session-cookie-missing");
  return cookie.split(";")[0];
};

describe("Final Product Runtime Qualification", () => {
  let server: Server;

  beforeEach(async () => {
    server = createCommercialRuntimeServer({
      databasePath: ":memory:",
      reasoning: {
        reason: (problem: string) => ({ problem, status: "verified", success: true }),
      },
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test("qualifies health, readiness, session, tenant, ingestion, analysis, reasoning and dashboard", async () => {
    const health = await request(server, "/health");
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toEqual({ status: "ok", service: "hooshyar-commercial-runtime" });

    const ready = await request(server, "/api/ready");
    expect(ready.status).toBe(200);
    const readyBody = await ready.json() as { status: string; capabilities: string[] };
    expect(readyBody.status).toBe("READY");
    expect(readyBody.capabilities).toEqual(expect.arrayContaining([
      "financial-ingestion",
      "financial-statement-analysis",
      "tenant-scoped-persistence",
      "reasoning",
    ]));

    const anonymousDashboard = await request(server, "/api/dashboard");
    expect(anonymousDashboard.status).toBe(401);
    await expect(anonymousDashboard.json()).resolves.toEqual({ error: "AUTHENTICATION_REQUIRED" });

    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "مدیرعامل", organization: "شرکت پذیرش نهایی" }),
    });
    expect(session.status).toBe(201);
    const cookie = cookieFrom(session);
    const sessionBody = await session.json() as { authenticated: boolean; tenantId: string };
    expect(sessionBody.authenticated).toBe(true);
    expect(sessionBody.tenantId).toMatch(/^tenant:/);

    const csv = [
      "date,account,debit,credit,currency",
      "2026-08-25,Cash,1000,0,IRR",
      "2026-08-25,Sales,0,1500,IRR",
      "2026-08-25,Rent,300,0,IRR",
    ].join("\n");

    const analysis = await request(server, "/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        sourceName: "acceptance-ledger.csv",
        csv,
        assets: 2000,
        liabilities: 500,
      }),
    });
    expect(analysis.status).toBe(200);
    const result = await analysis.json() as {
      status: string;
      tenantId: string;
      metrics: { revenue: number; expenses: number; profit: number; debtRatio: number };
      reasoningEvidence: { success: boolean };
      source: { sourceType: string; sha256: string };
    };
    expect(result.status).toBe("READY");
    expect(result.tenantId).toBe(sessionBody.tenantId);
    expect(result.metrics.revenue).toBe(1500);
    expect(result.metrics.expenses).toBe(1300);
    expect(result.metrics.profit).toBe(200);
    expect(result.metrics.debtRatio).toBe(0.25);
    expect(result.reasoningEvidence.success).toBe(true);
    expect(result.source.sourceType).toBe("CSV");
    expect(result.source.sha256).toMatch(/^[a-f0-9]{64}$/i);

    const dashboard = await request(server, "/api/dashboard", { headers: { cookie } });
    expect(dashboard.status).toBe(200);
    const dashboardBody = await dashboard.json() as {
      status: string;
      tenantId: string;
      analysisAvailable: boolean;
      metrics: { revenue: number; profit: number; risk: number };
    };
    expect(dashboardBody.status).toBe("READY");
    expect(dashboardBody.tenantId).toBe(sessionBody.tenantId);
    expect(dashboardBody.analysisAvailable).toBe(true);
    expect(dashboardBody.metrics).toEqual({ revenue: 1500, profit: 200, risk: 25 });
  });

  test("rejects invalid business input and keeps the authentication boundary fail-closed", async () => {
    const invalidSession = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "", organization: "" }),
    });
    expect(invalidSession.status).toBe(400);

    const unauthenticatedAnalysis = await request(server, "/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ csv: "invalid", assets: 1, liabilities: 1 }),
    });
    expect(unauthenticatedAnalysis.status).toBe(401);

    const sessionA = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "a", organization: "Tenant A" }),
    });
    const cookieA = cookieFrom(sessionA);

    const malformedAnalysis = await request(server, "/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieA },
      body: JSON.stringify({ csv: "date,account,debit,credit,currency\nnot-a-date,Cash,1,0,IRR", assets: 100, liabilities: 25 }),
    });
    expect(malformedAnalysis.status).toBe(400);
  });
});
