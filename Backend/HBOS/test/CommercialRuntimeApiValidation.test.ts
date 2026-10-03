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

describe("Commercial runtime API validation", () => {
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

  test("rejects /api/analyze with missing csv", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "qa", organization: "org" }),
    });
    const cookie = cookieFrom(session);
    const response = await request(server, "/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceName: "ledger.csv", assets: 1000, liabilities: 250 }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "CSV_REQUIRED" });
  });

  test("rejects /api/analyze with invalid balance sheet fields", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "qa", organization: "org" }),
    });
    const cookie = cookieFrom(session);
    const response = await request(server, "/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ csv: "date,account,debit,credit\n2026-08-01,Cash,1000,0,IRR", assets: "not-a-number", liabilities: 250 }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "BALANCE_SHEET_FIELDS_REQUIRED" });
  });

  test("passes valid /api/analyze request through", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "qa", organization: "org" }),
    });
    const cookie = cookieFrom(session);
    const response = await request(server, "/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ csv: "date,account,debit,credit,currency\n2026-08-01,Cash,1000,0,IRR\n2026-08-01,Sales,0,1000,IRR", sourceName: "ledger.csv", assets: 1000, liabilities: 250 }),
    });
    expect(response.status).toBe(200);
  });

  test("rejects /api/executive/workbench with missing targets", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "qa", organization: "org" }),
    });
    const cookie = cookieFrom(session);
    const response = await request(server, "/api/executive/workbench", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "EXECUTIVE_TARGETS_REQUIRED" });
  });

  test("rejects /api/executive/workbench with invalid target types", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "qa", organization: "org" }),
    });
    const cookie = cookieFrom(session);
    const response = await request(server, "/api/executive/workbench", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ targets: { revenue: "bad", profit: 100, profitMargin: 10, debtRatio: 5 } }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "EXECUTIVE_TARGETS_REQUIRED" });
  });

  test("rejects /api/assistant with missing question", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "qa", organization: "org" }),
    });
    const cookie = cookieFrom(session);
    const response = await request(server, "/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "ASSISTANT_QUESTION_REQUIRED" });
  });

  test("rejects /api/assistant with empty question", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "qa", organization: "org" }),
    });
    const cookie = cookieFrom(session);
    const response = await request(server, "/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ question: "   " }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "ASSISTANT_QUESTION_REQUIRED" });
  });

  test("sets security headers on all responses", async () => {
    const session = await request(server, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "qa", organization: "org" }),
    });
    expect(session.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(session.headers.get("X-Frame-Options")).toBe("DENY");
  });
});
