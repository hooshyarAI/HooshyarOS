import { Server } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";
import { SecurityEventLogger } from "../Entities/SecurityEventLogger";
import { join } from "node:path";
import { unlinkSync, existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

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

const listen = (server: ReturnType<typeof createCommercialRuntimeServer>) => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const close = (server: ReturnType<typeof createCommercialRuntimeServer>) => new Promise<void>((resolve) => server.close(() => resolve()));

const CSV = "date,account,debit,credit,currency\n2026-08-01,Cash,1000,0,IRR\n2026-08-01,Sales,0,1000,IRR";

function makeDbPath(): string {
  return join(__dirname, `test-e2e-security-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
}

function cleanup(dbPath: string) {
  try { if (existsSync(dbPath)) unlinkSync(dbPath); } catch { /* ignore */ }
}

describe("CommercialRuntimeServer E2E", () => {
  let server: Server;

  beforeEach(async () => {
    server = createCommercialRuntimeServer({
      databasePath: ":memory:",
      reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true, answer: "test answer" }) },
    });
    await listen(server);
  });

  afterEach(async () => {
    await close(server);
  });

  describe("Session lifecycle", () => {
    test("POST /api/session creates session returns 201 with cookie", async () => {
      const response = await request(server, "/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "user1", organization: "org1" }),
      });
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.authenticated).toBe(true);
      expect(body.tenantId).toBeDefined();
      expect(body.organization.name).toBe("org1");
      const cookie = response.headers.get("set-cookie");
      expect(cookie).toContain("hooshyar_session=");
      expect(cookie).toContain("HttpOnly");
    });

    test("GET /api/session with valid cookie returns 200", async () => {
      const session = await request(server, "/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "user1", organization: "org1" }),
      });
      const cookie = cookieFrom(session);
      const response = await request(server, "/api/session", {
        headers: { cookie },
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.authenticated).toBe(true);
      expect(body.tenantId).toBeDefined();
    });

    test("GET /api/session without cookie returns 401", async () => {
      const response = await request(server, "/api/session");
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.authenticated).toBe(false);
    });
  });

  describe("Financial analysis", () => {
    test("POST /api/analyze with valid CSV returns 200", async () => {
      const session = await request(server, "/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "user1", organization: "org1" }),
      });
      const cookie = cookieFrom(session);
      const response = await request(server, "/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ csv: CSV, sourceName: "ledger.csv", assets: 1000, liabilities: 250 }),
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe("READY");
      expect(body.tenantId).toBeDefined();
    });

    test("POST /api/analyze with missing CSV returns 400", async () => {
      const session = await request(server, "/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "user1", organization: "org1" }),
      });
      const cookie = cookieFrom(session);
      const response = await request(server, "/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ sourceName: "ledger.csv", assets: 1000, liabilities: 250 }),
      });
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("CSV_REQUIRED");
    });
  });

  describe("Executive workbench", () => {
    test("POST /api/executive/workbench after analysis returns 200", async () => {
      const session = await request(server, "/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "user1", organization: "org1" }),
      });
      const cookie = cookieFrom(session);
      await request(server, "/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ csv: CSV, sourceName: "ledger.csv", assets: 1000, liabilities: 250 }),
      });
      const response = await request(server, "/api/executive/workbench", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ targets: { revenue: 1000, profit: 200, profitMargin: 20, debtRatio: 10 } }),
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe("READY");
    });

    test("POST /api/executive/workbench without analysis returns 422", async () => {
      const session = await request(server, "/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "user1", organization: "org1" }),
      });
      const cookie = cookieFrom(session);
      const response = await request(server, "/api/executive/workbench", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ targets: { revenue: 1000, profit: 200, profitMargin: 20, debtRatio: 10 } }),
      });
      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error).toBe("EXECUTIVE_ANALYSIS_REQUIRED");
    });
  });

  describe("Assistant", () => {
    test("POST /api/assistant after analysis returns 200", async () => {
      const session = await request(server, "/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "user1", organization: "org1" }),
      });
      const cookie = cookieFrom(session);
      await request(server, "/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ csv: CSV, sourceName: "ledger.csv", assets: 1000, liabilities: 250 }),
      });
      const response = await request(server, "/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ question: "What is revenue?" }),
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe("READY");
      expect(body.answer).toBe("test answer");
    });

    test("POST /api/assistant without analysis returns 422", async () => {
      const session = await request(server, "/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "user1", organization: "org1" }),
      });
      const cookie = cookieFrom(session);
      const response = await request(server, "/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ question: "What is revenue?" }),
      });
      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error).toBe("ASSISTANT_ANALYSIS_REQUIRED");
    });

    test("POST /api/assistant with empty question returns 400", async () => {
      const session = await request(server, "/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "user1", organization: "org1" }),
      });
      const cookie = cookieFrom(session);
      await request(server, "/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ csv: CSV, sourceName: "ledger.csv", assets: 1000, liabilities: 250 }),
      });
      const response = await request(server, "/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ question: "   " }),
      });
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("ASSISTANT_QUESTION_REQUIRED");
    });
  });

  describe("Dashboard", () => {
    test("GET /api/dashboard without analysis returns 200 with empty metrics", async () => {
      const session = await request(server, "/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "user1", organization: "org1" }),
      });
      const cookie = cookieFrom(session);
      const response = await request(server, "/api/dashboard", {
        headers: { cookie },
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.analysisAvailable).toBe(false);
      expect(body.metrics).toEqual({ revenue: 0, profit: 0, risk: 0 });
    });

    test("GET /api/dashboard after analysis returns 200 with metrics", async () => {
      const session = await request(server, "/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "user1", organization: "org1" }),
      });
      const cookie = cookieFrom(session);
      await request(server, "/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ csv: CSV, sourceName: "ledger.csv", assets: 1000, liabilities: 250 }),
      });
      const response = await request(server, "/api/dashboard", {
        headers: { cookie },
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.analysisAvailable).toBe(true);
      expect(body.metrics.revenue).toBeGreaterThan(0);
    });
  });

  describe("Report", () => {
    test("GET /api/report after analysis returns 200", async () => {
      const session = await request(server, "/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "user1", organization: "org1" }),
      });
      const cookie = cookieFrom(session);
      await request(server, "/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ csv: CSV, sourceName: "ledger.csv", assets: 1000, liabilities: 250 }),
      });
      const response = await request(server, "/api/report", {
        headers: { cookie },
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe("READY");
    });

    test("GET /api/report without analysis returns 422", async () => {
      const session = await request(server, "/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "user1", organization: "org1" }),
      });
      const cookie = cookieFrom(session);
      const response = await request(server, "/api/report", {
        headers: { cookie },
      });
      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error).toBe("REPORT_ANALYSIS_REQUIRED");
    });
  });

  describe("Security events", () => {
    test("Unauthenticated request emits AUTHENTICATION_FAILURE event", async () => {
      const dbPath = makeDbPath();
      const logger = new SecurityEventLogger(dbPath);
      const serverWithLogger = createCommercialRuntimeServer({
        databasePath: ":memory:",
        reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true, answer: "test answer" }) },
        securityEventLogger: logger,
      });
      await listen(serverWithLogger);
      try {
        const response = await request(serverWithLogger, "/api/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        expect(response.status).toBe(401);
        const db = new DatabaseSync(dbPath);
        const events = db.prepare("SELECT reason FROM audit_events ORDER BY sequence ASC").all() as { reason: string }[];
        expect(events.some((e) => e.reason && e.reason.includes("AUTHENTICATION_FAILURE"))).toBe(true);
      } finally {
        await close(serverWithLogger);
        logger.close();
        cleanup(dbPath);
      }
    });
  });

  describe("Tenant isolation", () => {
    test("Two sessions get different tenantIds", async () => {
      const sessionA = await request(server, "/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "userA", organization: "orgA" }),
      });
      const bodyA = await sessionA.json();
      const sessionB = await request(server, "/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "userB", organization: "orgB" }),
      });
      const bodyB = await sessionB.json();
      expect(bodyA.tenantId).not.toBe(bodyB.tenantId);
    });

    test("Session A cannot see Session B's analysis data", async () => {
      const sessionA = await request(server, "/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "userA", organization: "orgA" }),
      });
      const cookieA = cookieFrom(sessionA);
      await request(server, "/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: cookieA },
        body: JSON.stringify({ csv: CSV, sourceName: "ledger.csv", assets: 1000, liabilities: 250 }),
      });

      const sessionB = await request(server, "/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "userB", organization: "orgB" }),
      });
      const cookieB = cookieFrom(sessionB);

      const dashboardB = await request(server, "/api/dashboard", {
        headers: { cookie: cookieB },
      });
      expect(dashboardB.status).toBe(200);
      const bodyB = await dashboardB.json();
      expect(bodyB.analysisAvailable).toBe(false);
      expect(bodyB.metrics.revenue).toBe(0);
    });
  });
});