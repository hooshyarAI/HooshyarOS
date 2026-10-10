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
        expect(res.headers["access-control-allow-headers"]).toBe("Content-Type, Cookie, Idempotency-Key");
    });

    it("attaches CORS headers to API responses", async () => {
        const server = await start();
        (globalThis as unknown as { __crsServers?: http.Server[] }).__crsServers = [server];
        const res = await request(server, "GET", "/health");
        expect(res.status).toBe(200);
        expect(res.headers["access-control-allow-origin"]).toBe(CORS_ORIGIN);
        expect(res.headers["access-control-allow-methods"]).toBe("GET, POST, OPTIONS");
        expect(res.headers["access-control-allow-headers"]).toBe("Content-Type, Cookie, Idempotency-Key");
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

    it("serves the result presentation and chart scripts referenced by the workspace shell", async () => {
    const server = await start();
    (globalThis as unknown as { __crsServers?: http.Server[] }).__crsServers = [server];

    const shell = await request(server, "GET", "/");
    const presentation = await request(server, "GET", "/result-presentation.js");
    const charts = await request(server, "GET", "/result-charts.js");

    expect(shell.status).toBe(200);
    expect(shell.body).toContain('src="/result-presentation.js"');
    expect(shell.body).toContain('src="/result-charts.js"');
    expect(presentation.status).toBe(200);
    expect(presentation.headers["content-type"]).toContain("text/javascript");
    expect(presentation.body).toContain("HooshyarResultPresentation");
    expect(charts.status).toBe(200);
    expect(charts.headers["content-type"]).toContain("text/javascript");
    expect(charts.body).toContain("HooshyarResultCharts");
  });

  it("uses default CORS origin when none is configured", async () => {
        const server = createCommercialRuntimeServer({});
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
        (globalThis as unknown as { __crsServers?: http.Server[] }).__crsServers = [server];
        const res = await request(server, "OPTIONS", "/api/analyze");
        expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    });

    it("denies unauthenticated API access with 401", async () => {
        const server = await start();
        (globalThis as unknown as { __crsServers?: http.Server[] }).__crsServers = [server];
        const dashboard = await request(server, "GET", "/api/dashboard");
        expect(dashboard.status).toBe(401);
        const analyze = await request(server, "POST", "/api/analyze");
        expect(analyze.status).toBe(401);
        const reportExport = await request(server, "POST", "/api/report/export");
        expect(reportExport.status).toBe(401);
    });
});

describe("CommercialRuntimeServer financial analytics report composition", () => {
    const CORS_ORIGIN = "http://localhost:3000";

    const start = async (): Promise<http.Server> => {
        const server = createCommercialRuntimeServer({ corsOrigin: CORS_ORIGIN, databasePath: ":memory:" });
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
        return server;
    };

    const requestJson = (
        server: http.Server,
        method: string,
        path: string,
        headers: Record<string, string> = {},
        body?: unknown,
    ): Promise<{ status: number; headers: http.OutgoingHttpHeaders; body: string }> => new Promise((resolve, reject) => {
        const addr = server.address();
        const port = typeof addr === "object" && addr ? addr.port : 0;
        const payload = body !== undefined ? JSON.stringify(body) : undefined;
        const allHeaders: Record<string, string> = { ...headers };
        if (payload !== undefined) {
            allHeaders["Content-Type"] = "application/json";
            allHeaders["Content-Length"] = String(Buffer.byteLength(payload));
        }
        const req = http.request({ hostname: "127.0.0.1", port, method, path, headers: allHeaders }, (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
        });
        req.on("error", reject);
        if (payload !== undefined) req.write(payload);
        req.end();
    });

    afterEach(async () => {
        const store = globalThis as unknown as { __crsServers?: http.Server[] };
        const servers = store.__crsServers ?? [];
        for (const s of servers) await new Promise<void>((r) => s.close(() => r()));
        store.__crsServers = [];
    });

    it("labels the analytics section in /api/report as Financial analytics:", async () => {
        const server = await start();
        (globalThis as unknown as { __crsServers?: http.Server[] }).__crsServers = [server];

        // Passwordless owner session for a fresh organization.
        const sessionRes = await requestJson(server, "POST", "/api/session", {}, { username: "qa-analyst", organization: "QA Analytics" });
        expect(sessionRes.status).toBe(201);
        const setCookie = sessionRes.headers["set-cookie"];
        const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
        expect(rawCookie).toBeTruthy();
        const cookie = String(rawCookie).split(";")[0];

        // Seed a canonical analysis (CSV ledger) so /api/report has an active result.
        const analyzeRes = await requestJson(server, "POST", "/api/analyze", { cookie }, {
            csv: "date,account,debit,credit,currency\n2026-08-01,Cash,1000,0,IRR\n2026-08-02,Sales,0,1500,IRR",
            sourceName: "qa-ledger.csv",
            assets: 10000,
            liabilities: 4000,
        });
        expect(analyzeRes.status).toBe(200);
        const analyze = JSON.parse(analyzeRes.body);
        expect(analyze.status).toBe("READY");

        // Run financial analytics with break-even inputs (no sourceSha256, so the
        // result correlates to the active analysis regardless of SHA).
        const insightsRes = await requestJson(server, "POST", "/api/financial/insights", { cookie }, {
            breakEven: { fixedCosts: 1000, variableCostPerUnit: 5, pricePerUnit: 10, unitsSold: 300 },
        });
        expect(insightsRes.status).toBe(200);
        const insights = JSON.parse(insightsRes.body);
        expect(insights.status).toBe("READY");
        expect(insights.breakEven?.breakEvenUnits).toBe(200);

        // After financial analytics, /api/report must surface the Persian-first
        // "تحلیل تکمیلی" section heading (and must never leak the internal
        // English "Financial analytics:" label to the user surface).
        const reportRes = await requestJson(server, "GET", "/api/report", { cookie });
        expect(reportRes.status).toBe(200);
        const report = JSON.parse(reportRes.body);
        expect(Array.isArray(report.sections)).toBe(true);
        expect(report.sections.some((section: string) => section.includes("تحلیل تکمیلی"))).toBe(true);
        expect(report.sections.some((section: string) => section.includes("Financial analytics:"))).toBe(false);
    }, 30000);
});
