import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

async function request(port: number, path: string, method = "GET", payload?: unknown): Promise<{ status: number; body: string; contentType: string }> {
    return new Promise((resolve, reject) => {
        const http = require("node:http") as typeof import("node:http");
        const body = payload === undefined ? undefined : JSON.stringify(payload);
        const request = http.request(`http://127.0.0.1:${port}${path}`, { method, headers: body ? { "content-type": "application/json" } : {} }, response => {
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

    afterAll(done => server.close(done));

    test("serves health, readiness and installable web shell", async () => {
        const health = await request(port, "/health");
        const ready = await request(port, "/api/ready");
        const home = await request(port, "/");
        const manifest = await request(port, "/manifest.webmanifest");
        expect(health.status).toBe(200);
        expect(JSON.parse(health.body).status).toBe("ok");
        expect(ready.status).toBe(200);
        expect(JSON.parse(ready.body).status).toBe("READY");
        expect(home.status).toBe(200);
        expect(home.contentType).toContain("text/html");
        expect(home.body).toContain("هوشیار.ai");
        expect(manifest.status).toBe(200);
        expect(manifest.contentType).toContain("manifest");
    });

    test("serves dashboard, report and billing surfaces", async () => {
        const dashboard = await request(port, "/api/dashboard");
        const report = await request(port, "/api/report");
        const plans = await request(port, "/api/plans");
        expect(dashboard.status).toBe(200);
        expect(JSON.parse(dashboard.body).status).toBe("READY");
        expect(report.status).toBe(200);
        expect(JSON.parse(report.body).status).toBe("READY");
        expect(plans.status).toBe(200);
        expect(JSON.parse(plans.body).plans.length).toBeGreaterThanOrEqual(3);
    });

    test("supports the commercial vertical slice from session through ingest and decision", async () => {
        const session = await request(port, "/api/session", "POST", { username: "مدیرعامل", organization: "تست هوشیار" });
        expect(session.status).toBe(200);
        expect(JSON.parse(session.body).organization.name).toBe("تست هوشیار");

        const ingest = await request(port, "/api/ingest", "POST", { amount: 500000, category: "فروش", organization: "تست هوشیار" });
        expect(ingest.status).toBe(200);
        expect(JSON.parse(ingest.body).persistence.version).toBeGreaterThan(0);
        expect(JSON.parse(ingest.body).dashboard.metrics.revenue).toBe(500000);

        const decision = await request(port, "/api/decision", "POST", { title: "افزایش بودجه فروش", organization: "تست هوشیار" });
        expect(decision.status).toBe(200);
        expect(JSON.parse(decision.body).status).toBe("READY");
    });

    test("loads representative demo evidence into the product path", async () => {
        const demo = await request(port, "/api/demo");
        expect(demo.status).toBe(200);
        const payload = JSON.parse(demo.body);
        expect(payload.records.length).toBeGreaterThanOrEqual(3);
        expect(payload.dashboard.metrics.revenue).toBeGreaterThan(0);
        expect(payload.report.status).toBe("READY");
    });
});
