import { CommercialIdentityService } from "../Product/CommercialIdentityService";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

type RequestOptions = { method?: string; body?: string; headers?: Record<string, string>; cookie?: string };

describe("Phase 10-3 identity hardening", () => {
    describe("CommercialIdentityService password hashing", () => {
        test("hashPassword and verifyPassword round-trip succeeds", async () => {
            const hash = await CommercialIdentityService.hashPassword("Sup3rSecret!");
            expect(hash.startsWith("scrypt$")).toBe(true);
            const parts = hash.split("$");
            expect(parts.length).toBe(3);
            expect(parts[1].length).toBeGreaterThan(0);
            expect(parts[2].length).toBeGreaterThan(0);
            await expect(CommercialIdentityService.verifyPassword("Sup3rSecret!", hash)).resolves.toBe(true);
        });

        test("verifyPassword rejects wrong password", async () => {
            const hash = await CommercialIdentityService.hashPassword("Sup3rSecret!");
            await expect(CommercialIdentityService.verifyPassword("wrong-password", hash)).resolves.toBe(false);
        });

        test("verifyPassword rejects malformed hash", async () => {
            await expect(CommercialIdentityService.verifyPassword("anything", "not-a-valid-hash")).resolves.toBe(false);
            await expect(CommercialIdentityService.verifyPassword("anything", "")).resolves.toBe(false);
            await expect(CommercialIdentityService.verifyPassword("anything", "scrypt$$$")).resolves.toBe(false);
        });

        test("two hashes of the same password use different salts", async () => {
            const a = await CommercialIdentityService.hashPassword("Sup3rSecret!");
            const b = await CommercialIdentityService.hashPassword("Sup3rSecret!");
            expect(a).not.toBe(b);
            expect(a.split("$")[1]).not.toBe(b.split("$")[1]);
        });

        test("instance methods delegate to static hashPassword/verifyPassword", async () => {
            const identity = new CommercialIdentityService();
            const hash = await identity.hashPassword("Sup3rSecret!");
            await expect(identity.verifyPassword("Sup3rSecret!", hash)).resolves.toBe(true);
            await expect(identity.verifyPassword("nope", hash)).resolves.toBe(false);
        });
    });

    describe("CommercialIdentityService session expiration", () => {
        test("session carries createdAt and expiresAt", () => {
            const identity = new CommercialIdentityService();
            identity.initialize();
            const session = identity.createSession("????", "?????? ???", "OWNER");
            expect(typeof session.createdAt).toBe("string");
            expect(typeof session.expiresAt).toBe("string");
            expect(Date.parse(session.expiresAt)).toBeGreaterThan(Date.parse(session.createdAt));
        });

        test("expired session returns null from getSession", () => {
            const identity = new CommercialIdentityService();
            identity.initialize();
            identity.setSessionTtl(1000);
            const session = identity.createSession("????", "?????? ???", "OWNER");
            identity.setNowProvider(() => Date.parse(session.createdAt) + 2000);
            expect(identity.getSession(session.token)).toBeNull();
            const events = identity.auditTrail().map(e => e.type);
            expect(events).toContain("SESSION_EXPIRED");
        });

        test("expired session cannot be authorized", () => {
            const identity = new CommercialIdentityService();
            identity.initialize();
            const session = identity.createSession("????", "?????? ???", "OWNER");
            identity.setNowProvider(() => Date.parse(session.expiresAt) + 1);
            expect(() => identity.authorize(session.token, "?????? ???", "READ_DASHBOARD")).toThrow("AUTHORIZATION_DENIED");
        });
    });

    describe("CommercialRuntimeServer session expiration", () => {
        const listen = (server: ReturnType<typeof createCommercialRuntimeServer>) => new Promise<{ port: number }>((resolve) => server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            resolve({ port: typeof address === "object" && address ? address.port : 0 });
        }));
        const close = (server: ReturnType<typeof createCommercialRuntimeServer>) => new Promise<void>((resolve) => server.close(() => resolve()));
        const request = async (port: number, path: string, options: RequestOptions = {}) => {
            const headers: Record<string, string> = { ...(options.headers ?? {}) };
            if (options.cookie) headers["cookie"] = options.cookie;
            const response = await fetch(`http://127.0.0.1:${port}${path}`, {
                method: options.method,
                body: options.body,
                headers,
            });
            const setCookie = response.headers.get("set-cookie");
            return { status: response.status, body: await response.json(), setCookie };
        };

        test("fresh session allows dashboard read", async () => {
            let current = 1000;
            const server = createCommercialRuntimeServer({ sessionTtlMs: 60_000, now: () => current });
            const { port } = await listen(server);
            try {
                const created = await request(port, "/api/session", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: "manager", organization: "Org" }),
                });
                expect(created.status).toBe(201);
                const cookie = created.setCookie?.split(";")[0];
                expect(cookie).toContain("hooshyar_session=");
                const dashboard = await request(port, "/api/dashboard", { cookie });
                expect(dashboard.status).toBe(200);
            } finally {
                await close(server);
            }
        });

        test("expired session returns 401", async () => {
            let current = 1_000_000;
            const server = createCommercialRuntimeServer({ sessionTtlMs: 1000, now: () => current });
            const { port } = await listen(server);
            try {
                const created = await request(port, "/api/session", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: "manager", organization: "Org" }),
                });
                expect(created.status).toBe(201);
                const cookie = created.setCookie?.split(";")[0];
                current += 2000;
                const dashboard = await request(port, "/api/dashboard", { cookie });
                expect(dashboard.status).toBe(401);
                expect(dashboard.body).toEqual({ error: "AUTHENTICATION_REQUIRED" });
            } finally {
                await close(server);
            }
        });

        test("/api/session reports 401 for expired cookie", async () => {
            let current = 1_000_000;
            const server = createCommercialRuntimeServer({ sessionTtlMs: 1000, now: () => current });
            const { port } = await listen(server);
            try {
                const created = await request(port, "/api/session", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: "manager", organization: "Org" }),
                });
                expect(created.status).toBe(201);
                const cookie = created.setCookie?.split(";")[0];
                current += 2000;
                const probe = await request(port, "/api/session", { cookie });
                expect(probe.status).toBe(401);
                expect(probe.body).toEqual({ authenticated: false });
            } finally {
                await close(server);
            }
        });
    });
});
