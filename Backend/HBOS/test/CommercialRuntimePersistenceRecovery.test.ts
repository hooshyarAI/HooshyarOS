import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const request = async (server: ReturnType<typeof createCommercialRuntimeServer>, path: string, options: RequestInit = {}) => {
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

describe("Commercial runtime persistence and recovery", () => {
  test("restores the latest analysis after a real process restart and preserves tenant identity", async () => {
    const directory = mkdtempSync(join(tmpdir(), "hooshyar-recovery-"));
    const databasePath = join(directory, "hooshyar.sqlite");
    const identity = { username: "qa-user", organization: "Hooshyar Recovery" };
    const csv = [
      "date,account,debit,credit,currency",
      "2026-08-01,Cash,1000,0,IRR",
      "2026-08-02,Sales,0,1500,IRR",
      "2026-08-03,Expense,300,0,IRR",
    ].join("\n");

    const first = createCommercialRuntimeServer({ databasePath, reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true }) } });
    await listen(first);
    const firstSession = await request(first, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(identity),
    });
    const firstCookie = cookieFrom(firstSession);
    const firstBody = await firstSession.json() as { tenantId: string };
    const analysis = await request(first, "/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: firstCookie },
      body: JSON.stringify({ csv, sourceName: "recovery-ledger.csv", assets: 2000, liabilities: 500 }),
    });
    expect(analysis.status).toBe(200);
    const beforeRestart = await request(first, "/api/dashboard", { headers: { cookie: firstCookie } });
    const beforePayload = await beforeRestart.json() as { analysisAvailable: boolean; metrics: { revenue: number; profit: number; risk: number } };
    expect(beforePayload).toMatchObject({ analysisAvailable: true, metrics: { revenue: 1500, profit: 200, risk: 25 } });
    await close(first);

    const second = createCommercialRuntimeServer({ databasePath, reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true }) } });
    await listen(second);
    const secondSession = await request(second, "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(identity),
    });
    const secondCookie = cookieFrom(secondSession);
    const secondBody = await secondSession.json() as { tenantId: string };
    expect(secondBody.tenantId).toBe(firstBody.tenantId);

    const afterRestart = await request(second, "/api/dashboard", { headers: { cookie: secondCookie } });
    expect(afterRestart.status).toBe(200);
    const afterPayload = await afterRestart.json() as { analysisAvailable: boolean; tenantId: string; metrics: { revenue: number; profit: number; risk: number } };
    expect(afterPayload).toMatchObject({
      status: "READY",
      tenantId: firstBody.tenantId,
      analysisAvailable: true,
      metrics: { revenue: 1500, profit: 200, risk: 25 },
    });
    await close(second);
    rmSync(directory, { recursive: true, force: true });
  });
});
