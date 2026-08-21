import { createCommercialRuntimeServer } from "../../AI_Runtime/CommercialRuntimeServer";

async function request(port: number, path: string, method = "GET", body?: string): Promise<{ status: number; body: string; contentType: string }> {
    return new Promise((resolve, reject) => {
        const http = require("node:http") as typeof import("node:http");
        const request = http.request(`http://127.0.0.1:${port}${path}`, {
            method,
            headers: body ? { "content-type": "application/json" } : undefined,
        }, response => {
            let responseBody = "";
            response.setEncoding("utf8");
            response.on("data", chunk => { responseBody += chunk; });
            response.on("end", () => resolve({ status: response.statusCode ?? 0, body: responseBody, contentType: String(response.headers["content-type"] ?? "") }));
        });
        request.on("error", reject);
        if (body) request.write(body);
        request.end();
    });
}

describe("Commercial web entrypoint", () => {
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

    test("serves the canonical product contract", async () => {
        const health = await request(port, "/health");
        const ready = await request(port, "/api/ready");
        const dashboard = await request(port, "/api/dashboard?organization=audit");
        const session = await request(port, "/api/session", "POST", JSON.stringify({ organization: "AuditCo" }));
        const home = await request(port, "/");
        const app = await request(port, "/app.js");
        const styles = await request(port, "/styles.css");
        const manifest = await request(port, "/manifest.webmanifest");

        expect(health.status).toBe(200);
        expect(JSON.parse(health.body).status).toBe("ok");

        expect(ready.status).toBe(200);
        expect(JSON.parse(ready.body).status).toBe("READY");

        expect(dashboard.status).toBe(200);
        expect(JSON.parse(dashboard.body).metrics).toEqual({ revenue: 0, profit: 0, risk: 0 });

        expect(session.status).toBe(200);
        expect(JSON.parse(session.body).organization.name).toBe("AuditCo");

        expect(home.status).toBe(200);
        expect(home.contentType).toContain("text/html");
        expect(home.body).toContain("هوشیار.ai");

        expect(app.status).toBe(200);
        expect(app.contentType).toContain("text/javascript");
        expect(app.body).toContain("/api/session");
        expect(app.body).toContain("/api/dashboard");

        expect(styles.status).toBe(200);
        expect(styles.contentType).toContain("text/css");

        expect(manifest.status).toBe(200);
        expect(manifest.contentType).toContain("manifest");
        expect(JSON.parse(manifest.body).start_url).toBe("/");
    });
});
