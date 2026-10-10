import { Server } from "node:http";
import { Script } from "node:vm";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const request = async (server: Server, path: string, options: RequestInit = {}) => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server-not-listening");
  return fetch(`http://127.0.0.1:${address.port}${path}`, options);
};

describe("Commercial runtime real business flow", () => {
  let server: Server;

  test("serves a coherent and syntactically valid authentication-capable web shell", async () => {
    const [root, index, viewModel, appResponse, styles, serviceWorker, standardsKnowledge] = await Promise.all([
      request(server, "/"),
      request(server, "/index.html"),
      request(server, "/executive-evaluation-view-model.js"),
      request(server, "/app.js"),
      request(server, "/styles.css"),
      request(server, "/sw.js"),
      request(server, "/api/knowledge/financial-standards"),
    ]);
    for (const response of [root, index, viewModel, appResponse, styles, serviceWorker, standardsKnowledge]) {
      expect(response.status).toBe(200);
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    }
    expect(root.headers.get("referrer-policy")).toBe("no-referrer");
    expect(root.headers.get("permissions-policy")).toContain("camera=()");
    const standardsPayload = await standardsKnowledge.json() as {
      catalogue: {
        version: string;
        standardEntries: Array<{ id: string; status: string }>;
        principles: { accountingAndReporting: string[]; auditingAndAssurance: string[] };
      };
    };
    expect(standardsPayload.catalogue.version).toBe("financial-standards-2026-10-10.v3");
    expect(standardsPayload.catalogue.standardEntries.map((entry) => entry.id)).toContain("IR-NAS-44");
    expect(standardsPayload.catalogue.standardEntries.map((entry) => entry.id)).toContain("IFRS-18");
    expect(standardsPayload.catalogue.principles.accountingAndReporting.length).toBeGreaterThanOrEqual(10);
    const contextualStandards = await request(server, "/api/knowledge/financial-standards?jurisdiction=IR&entityType=listed-company&fiscalYearStartJalali=1405-01-01&isListed=true");
    expect(contextualStandards.status).toBe(200);
    const contextualPayload = await contextualStandards.json() as { applicability: { status: string; finalDeterminationAllowed: boolean } };
    expect(contextualPayload.applicability.status).toBe("REVIEW_REQUIRED");
    expect(contextualPayload.applicability.finalDeterminationAllowed).toBe(false);
    expect(viewModel.headers.get("content-type")).toContain("text/javascript");
    expect(appResponse.headers.get("content-type")).toContain("text/javascript");
    expect(styles.headers.get("content-type")).toContain("text/css");
    const html = await root.text();
    expect(html).toContain('src="/executive-evaluation-view-model.js"');
    expect(html).toContain('src="/app.js"');
    expect(html).toContain('id="session-mode"');
    expect(html).toContain('id="password"');
    expect(html).toContain('id="invite-form"');
    const app = await appResponse.text();
    const viewModelSource = await viewModel.text();
    const worker = await serviceWorker.text();
    expect(() => new Script(app)).not.toThrow();
    expect(() => new Script(viewModelSource)).not.toThrow();
    expect(worker).toContain("hooshyar-shell-v3");
    expect(worker).toContain("'/executive-evaluation-view-model.js'");
    expect(app).toContain("request('/api/logout'");
    expect(app).toContain("request('/api/invitations'");
    expect(viewModelSource).toContain("buildRows");
  });

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
      body: JSON.stringify({ mode: "register", username: "مدیرعامل", organization: "شرکت نمونه", password: "Strong-Demo-Password-2026!" }),
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
      body: JSON.stringify({ mode: "register", username: "مدیرعامل", organization: "شرکت الف", password: "Strong-Demo-Password-2026!" }),
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
      body: JSON.stringify({ mode: "register", username: "مدیرعامل", organization: "شرکت ب", password: "Strong-Demo-Password-2026!" }),
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

  test("enforces invited-member role at the real runtime boundary", async () => {
    const ownerResponse = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "register",
        username: "owner",
        organization: "Role Test Org",
        password: "Strong-Demo-Password-2026!",
      }),
    });
    expect(ownerResponse.status).toBe(201);
    const ownerCookie = ownerResponse.headers.get("set-cookie")!.split(";")[0];
    const ownerData = await ownerResponse.json() as { tenantId: string };

    const invitationResponse = await request(server, "/api/invitations", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ownerCookie },
      body: JSON.stringify({ role: "VIEWER" }),
    });
    expect(invitationResponse.status).toBe(201);
    const invitation = await invitationResponse.json() as { code: string; role: string };
    expect(invitation.role).toBe("VIEWER");

    const viewerResponse = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "join",
        username: "viewer",
        password: "Strong-Demo-Password-2026!",
        invitationCode: invitation.code,
      }),
    });
    expect(viewerResponse.status).toBe(201);
    const viewerCookie = viewerResponse.headers.get("set-cookie")!.split(";")[0];
    const viewerData = await viewerResponse.json() as { tenantId: string; role: string };
    expect(viewerData.tenantId).toBe(ownerData.tenantId);
    expect(viewerData.role).toBe("VIEWER");

    const dashboard = await request(server, "/api/dashboard", { headers: { cookie: viewerCookie } });
    expect(dashboard.status).toBe(200);

    const forbiddenTargets = await request(server, "/api/executive-targets", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: viewerCookie },
      body: JSON.stringify({ targets: { revenue: 1, profit: 1, profitMargin: 0.1, debtRatio: 0.1 } }),
    });
    expect(forbiddenTargets.status).toBe(403);
    await expect(forbiddenTargets.json()).resolves.toEqual({ error: "AUTHORIZATION_DENIED" });

    const forbiddenInvites = await request(server, "/api/invitations", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: viewerCookie },
      body: JSON.stringify({ role: "VIEWER" }),
    });
    expect(forbiddenInvites.status).toBe(403);

    const forbiddenAnalysis = await request(server, "/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: viewerCookie },
      body: JSON.stringify({}),
    });
    expect(forbiddenAnalysis.status).toBe(403);
  });

  test("blocks financial analysis when assets denominator is zero and does not persist it", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "register", username: "مدیرعامل", organization: "شرکت با دارایی صفر", password: "Strong-Demo-Password-2026!" }),
    });
    const cookie = session.headers.get("set-cookie")!.split(";")[0];
    const csv = "date,account,debit,credit,currency\n2026-08-01,Cash,1000,0,IRR\n2026-08-01,Sales,0,1000,IRR";

    const response = await request(server, "/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ csv, sourceName: "zero-assets.csv", assets: 0, liabilities: 250 }),
    });

    expect(response.status).toBe(422);
    const blocked = await response.json() as {
      status: string;
      metrics: { status: string; reason: string };
      reasoningEvidence: { success: boolean; status: string };
    };
    expect(blocked.status).toBe("BLOCKED");
    expect(blocked.metrics).toMatchObject({ status: "BLOCKED", reason: "DEBT_RATIO_DENOMINATOR_ZERO" });
    expect(blocked.reasoningEvidence).toEqual({ success: false, status: "DEBT_RATIO_DENOMINATOR_ZERO" });

    const dashboard = await request(server, "/api/dashboard", { headers: { cookie } });
    const payload = await dashboard.json() as { analysisAvailable: boolean; history: unknown[] };
    expect(payload.analysisAvailable).toBe(false);
    expect(payload.history).toEqual([]);
  });

  test("rejects incomplete or non-positive executive targets", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "register", username: "مدیرعامل", organization: "شرکت هدف‌ها", password: "Strong-Demo-Password-2026!" }),
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
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    await expect(response.json()).resolves.toEqual({ error: "AUTHENTICATION_REQUIRED" });
  });
});
