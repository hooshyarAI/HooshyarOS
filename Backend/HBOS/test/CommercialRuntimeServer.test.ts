import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

async function request(port: number, path: string, method = "GET", payload?: unknown, token?: string): Promise<{ status: number; body: string; contentType: string }> {
    return new Promise((resolve, reject) => {
        const http = require("node:http") as typeof import("node:http");
        const body = payload === undefined ? undefined : JSON.stringify(payload);
        const headers: Record<string, string> = body ? { "content-type": "application/json" } : {};
        if (token) headers.authorization = `Bearer ${token}`;
        const request = http.request(`http://127.0.0.1:${port}${path}`, { method, headers }, response => {
            let text = "";
            response.setEncoding("utf8");
            response.on("data", chunk => { text += chunk; });
            response.on("end", () => resolve({ status: response.statusCode ?? 0, body: text, contentType: String(response.headers["content-type"] ?? "") }));
        });
        request.on("error", reject);
        if (body) request.write(body);
        request.end();
    });
}

describe("Commercial runtime application path", () => {
    let server: ReturnType<typeof createCommercialRuntimeServer>;
    let port: number;
    beforeAll(done => {
        server = createCommercialRuntimeServer();
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            if (!address || typeof address === "string") return done(new Error("runtime did not bind"));
            port = address.port;
            done();
        });
    });
    afterAll(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
    test("serves health, readiness and installable web shell", async () => {
        const health = await request(port, "/health"); const ready = await request(port, "/api/ready"); const home = await request(port, "/"); const manifest = await request(port, "/manifest.webmanifest");
        expect(health.status).toBe(200); expect(JSON.parse(health.body).status).toBe("ok"); expect(ready.status).toBe(200); expect(JSON.parse(ready.body).status).toBe("READY"); expect(home.status).toBe(200); expect(home.contentType).toContain("text/html"); expect(home.body).toContain("هوشیار.ai"); expect(manifest.status).toBe(200); expect(manifest.contentType).toContain("manifest");
    });
    test("serves dashboard, report and billing surfaces", async () => {
        const dashboard = await request(port, "/api/dashboard"); const report = await request(port, "/api/report"); const plans = await request(port, "/api/plans");
        expect(dashboard.status).toBe(200); expect(JSON.parse(dashboard.body).status).toBe("READY"); expect(report.status).toBe(200); expect(JSON.parse(report.body).status).toBe("READY"); expect(plans.status).toBe(200); expect(JSON.parse(plans.body).plans.length).toBeGreaterThanOrEqual(3);
    });
    test("supports authenticated commercial flow and rejects cross-tenant operations", async () => {
        const anonymous = await request(port, "/api/ingest", "POST", { amount: 1, category: "فروش", organization: "تست هوشیار" });
        expect(anonymous.status).toBe(401);

        const session = await request(port, "/api/session", "POST", { username: "مدیرعامل", organization: "تست هوشیار" });
        const sessionPayload = JSON.parse(session.body);
        const token = sessionPayload.token as string;
        expect(session.status).toBe(200);
        expect(sessionPayload.organization.name).toBe("تست هوشیار");
        expect(sessionPayload.user.role).toBe("OWNER");

        const ingest = await request(port, "/api/ingest", "POST", { amount: 500000, category: "فروش", organization: "تست هوشیار" }, token);
        expect(ingest.status).toBe(200); expect(JSON.parse(ingest.body).persistence.version).toBeGreaterThan(0); expect(JSON.parse(ingest.body).dashboard.metrics.revenue).toBe(500000);

        const crossTenant = await request(port, "/api/ingest", "POST", { amount: 100, category: "فروش", organization: "سازمان دیگر" }, token);
        expect(crossTenant.status).toBe(401);

        const decision = await request(port, "/api/decision", "POST", { title: "افزایش بودجه فروش", organization: "تست هوشیار" }, token);
        expect(decision.status).toBe(200); expect(JSON.parse(decision.body).status).toBe("READY");

        const logout = await request(port, "/api/logout", "POST", undefined, token);
        expect(logout.status).toBe(200);
        const afterLogout = await request(port, "/api/ingest", "POST", { amount: 10, category: "فروش", organization: "تست هوشیار" }, token);
        expect(afterLogout.status).toBe(401);
    });
    test("loads representative demo evidence into the product path", async () => {
        const demo = await request(port, "/api/demo"); expect(demo.status).toBe(200); const payload = JSON.parse(demo.body); expect(payload.records.length).toBeGreaterThanOrEqual(3); expect(payload.dashboard.metrics.revenue).toBeGreaterThan(0); expect(payload.report.status).toBe("READY");
    });
});
