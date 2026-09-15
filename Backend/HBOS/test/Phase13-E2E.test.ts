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

const CSV = "date,account,debit,credit,currency\n2026-08-01,Cash,1000,0,IRR\n2026-08-01,Sales,0,1000,IRR";

describe("Phase 13 E2E — authentication, RBAC and tenant isolation", () => {
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

    const register = (username: string, password: string, organization: string) =>
        request(server, "/api/auth/register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username, password, organization }),
        });

    const login = (username: string, password: string, organization: string) =>
        request(server, "/api/auth/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username, password, organization }),
        });

    test("full journey: register -> session -> RBAC -> analysis -> refresh -> logout", async () => {
        const ownerRegistration = await register("owner", "Sup3rSecret!", "Acme");
        expect(ownerRegistration.status).toBe(201);
        const ownerCookie = cookieFrom(ownerRegistration);
        const ownerBody = await ownerRegistration.json();
        expect(ownerBody.role).toBe("OWNER");
        expect(ownerBody.tenantId).toMatch(/^tenant:/);

        const ownerSession = await request(server, "/api/session", { headers: { cookie: ownerCookie } });
        expect(ownerSession.status).toBe(200);
        expect((await ownerSession.json()).authenticated).toBe(true);

        const viewerRegistration = await register("viewer", "Sup3rSecret!", "Acme");
        expect(viewerRegistration.status).toBe(201);
        const viewerCookie = cookieFrom(viewerRegistration);
        expect((await viewerRegistration.json()).role).toBe("VIEWER");

        const viewerAnalyze = await request(server, "/api/analyze", {
            method: "POST",
            headers: { "content-type": "application/json", cookie: viewerCookie },
            body: JSON.stringify({ csv: CSV, sourceName: "ledger.csv", assets: 1000, liabilities: 250 }),
        });
        expect(viewerAnalyze.status).toBe(403);
        expect((await viewerAnalyze.json()).error).toBe("INSUFFICIENT_PERMISSIONS");

        const viewerDashboard = await request(server, "/api/dashboard", { headers: { cookie: viewerCookie } });
        expect(viewerDashboard.status).toBe(200);

        const ownerAnalyze = await request(server, "/api/analyze", {
            method: "POST",
            headers: { "content-type": "application/json", cookie: ownerCookie },
            body: JSON.stringify({ csv: CSV, sourceName: "ledger.csv", assets: 1000, liabilities: 250 }),
        });
        expect(ownerAnalyze.status).toBe(200);
        expect((await ownerAnalyze.json()).status).toBe("READY");

        const relogin = await login("owner", "Sup3rSecret!", "Acme");
        expect(relogin.status).toBe(200);
        const reloginCookie = cookieFrom(relogin);

        const refresh = await request(server, "/api/auth/refresh", { method: "POST", headers: { cookie: reloginCookie } });
        expect(refresh.status).toBe(200);
        expect((await refresh.json()).authenticated).toBe(true);

        const logout = await request(server, "/api/auth/logout", { method: "POST", headers: { cookie: reloginCookie } });
        expect(logout.status).toBe(200);
        const afterLogout = await request(server, "/api/session", { headers: { cookie: reloginCookie } });
        expect(afterLogout.status).toBe(401);
    });

    test("rejects invalid credentials and unauthenticated access", async () => {
        await register("owner", "Sup3rSecret!", "Acme");
        const bad = await login("owner", "wrong-password", "Acme");
        expect(bad.status).toBe(401);
        expect((await bad.json()).error).toBe("INVALID_CREDENTIALS");

        const noSession = await request(server, "/api/dashboard");
        expect(noSession.status).toBe(401);
        expect((await noSession.json()).error).toBe("AUTHENTICATION_REQUIRED");
    });

    test("isolates tenants so one organization cannot read another's data", async () => {
        const acme = await register("acme-owner", "Sup3rSecret!", "Acme");
        const acmeCookie = cookieFrom(acme);
        const acmeTenant = (await acme.json()).tenantId;

        await request(server, "/api/analyze", {
            method: "POST",
            headers: { "content-type": "application/json", cookie: acmeCookie },
            body: JSON.stringify({ csv: CSV, sourceName: "ledger.csv", assets: 1000, liabilities: 250 }),
        });

        const other = await register("other-owner", "Sup3rSecret!", "Other");
        const otherCookie = cookieFrom(other);
        const otherBody = await other.json();
        expect(otherBody.tenantId).not.toBe(acmeTenant);

        const otherDashboard = await request(server, "/api/dashboard", { headers: { cookie: otherCookie } });
        expect(otherDashboard.status).toBe(200);
        const dashboard = await otherDashboard.json();
        expect(dashboard.analysisAvailable).toBe(false);
        expect(dashboard.metrics.revenue).toBe(0);
    });

    test("requires a real password and never authenticates the wrong tenant", async () => {
        const missingPassword = await request(server, "/api/auth/register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username: "nopass", organization: "Acme" }),
        });
        expect(missingPassword.status).toBe(400);

        await register("owner", "Sup3rSecret!", "Acme");
        const wrongTenant = await login("owner", "Sup3rSecret!", "Other");
        expect(wrongTenant.status).toBe(401);
    });
});
