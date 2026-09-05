import http from "node:http";
import { createCommercialRuntimeServer } from "./CommercialRuntimeServer";

describe("CommercialRuntimeServer security headers", () => {
    const CORS_ORIGIN = "http://localhost:3000";

    const start = async () => {
        const server = createCommercialRuntimeServer({ corsOrigin: CORS_ORIGIN });
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
        return server;
    };

    const request = (server: http.Server, method: string, path: string, headers: Record<string, string> = {}): Promise<{ status: number; headers: http.OutgoingHttpHeaders; body: string }> => new Promise((resolve, reject) => {
        const addr = server.address();
        const port = typeof addr === "object" && addr ? addr.port : 0;
        const req = http.request({ hostname: "127.0.0.1", port, method, path, headers }, (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
        });
        req.on("error", reject);
        req.end();
    });

    afterEach(async () => {
        const servers = (globalThis as unknown as { __crsServers?: http.Server[] }).__crsServers ?? [];
        for (const s of servers) await new Promise<void>((r) => s.close(() => r()));
    });

    it("responds to OPTIONS preflight with 204 and CORS headers", async () => {
        const server = await start();
        (globalThis as unknown as { __crsServers?: http.Server[] }).__crsServers = [server];
        const res = await request(server, "OPTIONS", "/api/analyze");
        expect(res.status).toBe(204);
        expect(res.headers["access-control-allow-origin"]).toBe(CORS_ORIGIN);
        expect(res.headers["access-control-allow-methods"]).toBe("GET, POST, OPTIONS");
        expect(res.headers["access-control-allow-headers"]).toBe("Content-Type, Cookie");
    });

    it("attaches CORS headers to API responses", async () => {
        const server = await start();
        (globalThis as unknown as { __crsServers?: http.Server[] }).__crsServers = [server];
        const res = await request(server, "GET", "/health");
        expect(res.status).toBe(200);
        expect(res.headers["access-control-allow-origin"]).toBe(CORS_ORIGIN);
        expect(res.headers["access-control-allow-methods"]).toBe("GET, POST, OPTIONS");
        expect(res.headers["access-control-allow-headers"]).toBe("Content-Type, Cookie");
    });

    it("attaches X-Content-Type-Options and X-Frame-Options to API responses", async () => {
        const server = await start();
        (globalThis as unknown as { __crsServers?: http.Server[] }).__crsServers = [server];
        const res = await request(server, "GET", "/health");
        expect(res.headers["x-content-type-options"]).toBe("nosniff");
        expect(res.headers["x-frame-options"]).toBe("DENY");
    });

    it("omits CORS headers from static asset responses", async () => {
        const server = await start();
        (globalThis as unknown as { __crsServers?: http.Server[] }).__crsServers = [server];
        const res = await request(server, "GET", "/styles.css");
        expect(res.status).toBe(200);
        expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("uses default CORS origin when none is configured", async () => {
        const server = createCommercialRuntimeServer({});
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
        (globalThis as unknown as { __crsServers?: http.Server[] }).__crsServers = [server];
        const res = await request(server, "OPTIONS", "/api/analyze");
        expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    });
});
