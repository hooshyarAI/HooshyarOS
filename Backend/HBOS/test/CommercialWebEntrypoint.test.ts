import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

async function request(port: number, path: string): Promise<{ status: number; body: string; contentType: string }> {
    return new Promise((resolve, reject) => {
        const http = require("node:http") as typeof import("node:http");
        const request = http.request(`http://127.0.0.1:${port}${path}`, { method: "GET" }, response => {
            let body = "";
            response.setEncoding("utf8");
            response.on("data", chunk => { body += chunk; });
            response.on("end", () => resolve({ status: response.statusCode ?? 0, body, contentType: String(response.headers["content-type"] ?? "") }));
        });
        request.on("error", reject);
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

    test("serves a responsive product shell and its executable client assets", async () => {
        const home = await request(port, "/");
        const app = await request(port, "/app.js");
        const styles = await request(port, "/styles.css");
        const manifest = await request(port, "/manifest.webmanifest");

        expect(home.status).toBe(200);
        expect(home.contentType).toContain("text/html");
        expect(home.body).toContain("هوشیار.ai");
        expect(home.body).toContain("/app.js");
        expect(home.body).toContain("/manifest.webmanifest");

        expect(app.status).toBe(200);
        expect(app.contentType).toContain("text/javascript");
        expect(app.body).toContain("/api/session");
        expect(app.body).toContain("/api/dashboard");

        expect(styles.status).toBe(200);
        expect(styles.contentType).toContain("text/css");
        expect(styles.body).toContain("@media");

        expect(manifest.status).toBe(200);
        expect(manifest.contentType).toContain("manifest");
        expect(JSON.parse(manifest.body).start_url).toBe("/");
    });
});
