import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

async function request(port: number, path: string): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
        const http = require("node:http") as typeof import("node:http");
        http.get(`http://127.0.0.1:${port}${path}`, response => {
            let body = "";
            response.setEncoding("utf8");
            response.on("data", chunk => { body += chunk; });
            response.on("end", () => resolve({ status: response.statusCode ?? 0, body }));
        }).on("error", reject);
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

    test("serves health and readiness", async () => {
        const health = await request(port, "/health");
        const ready = await request(port, "/api/ready");
        expect(health.status).toBe(200);
        expect(JSON.parse(health.body).status).toBe("ok");
        expect(ready.status).toBe(200);
        expect(JSON.parse(ready.body).status).toBe("READY");
    });

    test("serves commercial dashboard, report and billing surfaces", async () => {
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
});
