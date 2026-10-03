import { Server } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const request = async (server: Server, path: string, options: RequestInit = {}) => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server-not-listening");
  return fetch(`http://127.0.0.1:${address.port}${path}`, options);
};

const listen = (server: Server) => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const close = (server: Server) => new Promise<void>((resolve) => server.close(() => resolve()));

const postJson = (server: Server, path: string, body: unknown, cookie?: string) =>
  request(server, path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });

const cookieFrom = (response: Response): string => {
  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error("session-cookie-missing");
  return cookie.split(";")[0];
};

describe("Commercial session bootstrap security", () => {
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

  test("passwordless bootstrap provisions the first owner of a brand-new organization", async () => {
    const response = await postJson(server, "/api/session", { username: "founder", organization: "Acme" });
    expect(response.status).toBe(201);
    const body = await response.json() as { authenticated: boolean; tenantId: string; role: string };
    expect(body.authenticated).toBe(true);
    expect(body.role).toBe("OWNER");
    expect(body.tenantId).toBeDefined();
  });

  test("passwordless bootstrap cannot mint a new owner inside an established organization", async () => {
    const registration = await postJson(server, "/api/auth/register", {
      username: "owner",
      organization: "Established Co",
      password: "correct-horse-battery",
    });
    expect(registration.status).toBe(201);
    const ownerCookie = cookieFrom(registration);

    const takeover = await postJson(server, "/api/session", { username: "attacker", organization: "Established Co" });
    expect(takeover.status).toBe(403);
    const body = await takeover.json() as { error: string };
    expect(body.error).toBe("ORGANIZATION_ALREADY_ESTABLISHED");

    const attackerDashboard = await request(server, "/api/dashboard", { headers: { cookie: ownerCookie } });
    expect(attackerDashboard.status).toBe(200);
  });

  test("passwordless bootstrap cannot seize an already-activated account", async () => {
    const registration = await postJson(server, "/api/auth/register", {
      username: "owner",
      organization: "Activated Co",
      password: "correct-horse-battery",
    });
    expect(registration.status).toBe(201);

    const seizure = await postJson(server, "/api/session", { username: "owner", organization: "Activated Co" });
    expect(seizure.status).toBe(403);
    const body = await seizure.json() as { error: string };
    expect(body.error).toBe("PASSWORD_AUTHENTICATION_REQUIRED");

    const login = await postJson(server, "/api/auth/login", {
      username: "owner",
      organization: "Activated Co",
      password: "correct-horse-battery",
    });
    expect(login.status).toBe(200);
    expect(cookieFrom(login)).toContain("hooshyar_session=");
  });

  test("existing pending bootstrap account remains resumable for recovery compatibility", async () => {
    const first = await postJson(server, "/api/session", { username: "qa-user", organization: "Recovery Co" });
    expect(first.status).toBe(201);
    const firstBody = await first.json() as { tenantId: string };

    const second = await postJson(server, "/api/session", { username: "qa-user", organization: "Recovery Co" });
    expect(second.status).toBe(201);
    const secondBody = await second.json() as { tenantId: string };
    expect(secondBody.tenantId).toBe(firstBody.tenantId);
  });
});
