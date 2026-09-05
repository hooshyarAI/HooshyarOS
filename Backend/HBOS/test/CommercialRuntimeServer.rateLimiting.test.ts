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

const listen = (server: ReturnType<typeof createCommercialRuntimeServer>) => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const close = (server: ReturnType<typeof createCommercialRuntimeServer>) => new Promise<void>((resolve) => server.close(() => resolve()));

const CSV = "date,account,debit,credit,currency\n2026-08-01,Cash,1000,0,IRR\n2026-08-01,Sales,0,1000,IRR";

describe("CommercialRuntimeServer rate limiting", () => {
  let server: Server;

  beforeEach(async () => {
    server = createCommercialRuntimeServer({
      databasePath: ":memory:",
      reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true }) },
    });
    await listen(server);
  });

  afterEach(async () => {
    await close(server);
  });

  test("blocks /api/analyze after capacity exceeded", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "qa", organization: "org" }),
    });
    const cookie = cookieFrom(session);
    const okBody = { csv: CSV, sourceName: "ledger.csv", assets: 1000, liabilities: 250 };

    for (let i = 0; i < 5; i++) {
      const response = await request(server, "/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify(okBody),
      });
      expect(response.status).toBe(200);
    }

    const blocked = await request(server, "/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(okBody),
    });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "RATE_LIMIT_EXCEEDED" });
  });

  test("blocks /api/executive/workbench after capacity exceeded", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "qa", organization: "org" }),
    });
    const cookie = cookieFrom(session);

    const okAnalyze = { csv: CSV, sourceName: "ledger.csv", assets: 1000, liabilities: 250 };
    await request(server, "/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(okAnalyze),
    });

    const okBody = { targets: { revenue: 1000, profit: 200, profitMargin: 20, debtRatio: 10 } };
    for (let i = 0; i < 4; i++) {
      const response = await request(server, "/api/executive/workbench", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify(okBody),
      });
      expect(response.status).toBe(200);
    }

    const blocked = await request(server, "/api/executive/workbench", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(okBody),
    });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "RATE_LIMIT_EXCEEDED" });
  });

  test("blocks /api/assistant after capacity exceeded", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "qa", organization: "org" }),
    });
    const cookie = cookieFrom(session);

    const okAnalyze = { csv: CSV, sourceName: "ledger.csv", assets: 1000, liabilities: 250 };
    await request(server, "/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(okAnalyze),
    });

    const okBody = { question: "What is revenue?" };
    for (let i = 0; i < 4; i++) {
      const response = await request(server, "/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify(okBody),
      });
      expect(response.status).toBe(200);
    }

    const blocked = await request(server, "/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(okBody),
    });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "RATE_LIMIT_EXCEEDED" });
  });

  test("rate limiting is per-session, not global", async () => {
    const sessionA = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "qa", organization: "org" }),
    });
    const cookieA = cookieFrom(sessionA);

    const sessionB = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "qb", organization: "org" }),
    });
    const cookieB = cookieFrom(sessionB);

    const okBody = { csv: CSV, sourceName: "ledger.csv", assets: 1000, liabilities: 250 };

    for (let i = 0; i < 5; i++) {
      const responseA = await request(server, "/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: cookieA },
        body: JSON.stringify(okBody),
      });
      expect(responseA.status).toBe(200);
    }

    const blockedA = await request(server, "/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieA },
      body: JSON.stringify(okBody),
    });
    expect(blockedA.status).toBe(429);

    const okB = await request(server, "/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieB },
      body: JSON.stringify(okBody),
    });
    expect(okB.status).toBe(200);
  });
});
