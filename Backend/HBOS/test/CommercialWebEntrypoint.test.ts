import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

interface HttpResponse {
    status: number;
    body: string;
    contentType: string;
    setCookie: string;
}

async function request(port: number, path: string, options: { method?: string; body?: string; cookie?: string } = {}): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
        const http = require("node:http") as typeof import("node:http");
        const headers: Record<string, string> = {};
        if (options.body !== undefined) {
            headers["content-type"] = "application/json";
            headers["content-length"] = String(Buffer.byteLength(options.body));
        }
        if (options.cookie) headers.cookie = options.cookie;
        const req = http.request(`http://127.0.0.1:${port}${path}`, { method: options.method ?? "GET", headers }, response => {
            let body = "";
            response.setEncoding("utf8");
            response.on("data", chunk => { body += chunk; });
            response.on("end", () => resolve({
                status: response.statusCode ?? 0,
                body,
                contentType: String(response.headers["content-type"] ?? ""),
                setCookie: String(response.headers["set-cookie"] ?? ""),
            }));
        });
        req.on("error", reject);
        if (options.body !== undefined) req.write(options.body);
        req.end();
    });
}

describe("Commercial web entrypoint", () => {
    let server: ReturnType<typeof createCommercialRuntimeServer>;
    let port: number;

    beforeAll(done => {
        server = createCommercialRuntimeServer({ databasePath: ":memory:" });
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
        const offlineSync = await request(port, "/offline-sync.js");

        expect(home.status).toBe(200);
        expect(home.contentType).toContain("text/html");
        expect(home.body).toContain("هوشیارOS");
        expect(home.body).toContain("/app.js");
        expect(home.body).toContain("/offline-sync.js");
        expect(home.body).toContain("/manifest.webmanifest");
        expect(home.body).toContain("register-form");
        expect(home.body).toContain("login-form");
        expect(home.body).toContain('id="logout-button"');

        expect(app.status).toBe(200);
        expect(app.contentType).toContain("text/javascript");
        expect(app.body).toContain("/api/session");
        expect(app.body).toContain("/api/dashboard");
        expect(app.body).toContain("/api/auth/register");
        expect(app.body).toContain("/api/auth/login");
        expect(app.body).toContain("/api/auth/logout");
        expect(app.body).toContain("HooshyarOfflineSync");

        expect(offlineSync.status).toBe(200);
        expect(offlineSync.contentType).toContain("text/javascript");
        expect(offlineSync.body).toContain("createOfflineSync");
        expect(offlineSync.body).toContain("/api/ingest");
        expect(offlineSync.body).toContain("/api/sync/state");

        expect(styles.status).toBe(200);
        expect(styles.contentType).toContain("text/css");
        expect(styles.body).toContain("@media");

        expect(manifest.status).toBe(200);
        expect(manifest.contentType).toContain("manifest");
        expect(JSON.parse(manifest.body).start_url).toBe("/");
    });

    test("exposes the real password auth path the web client calls (HTTP end-to-end)", async () => {
        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const username = `owner-${suffix}`;
        const organization = `Org ${suffix}`;
        const password = "correct-horse-battery";

        const registered = await request(port, "/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ username, organization, password }),
        });
        expect(registered.status).toBe(201);
        const registeredBody = JSON.parse(registered.body);
        expect(registeredBody.authenticated).toBe(true);
        expect(registeredBody.role).toBe("OWNER");
        expect(registered.setCookie).toContain("hooshyar_session=");

        const invalid = await request(port, "/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ username, organization, password: "wrong-password" }),
        });
        expect(invalid.status).toBe(401);
        expect(JSON.parse(invalid.body)).toEqual({ error: "INVALID_CREDENTIALS" });

        const login = await request(port, "/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ username, organization, password }),
        });
        expect(login.status).toBe(200);
        const cookie = login.setCookie.split(";")[0];
        expect(cookie).toContain("hooshyar_session=");

        const session = await request(port, "/api/session", { cookie });
        expect(session.status).toBe(200);
        const sessionBody = JSON.parse(session.body);
        expect(sessionBody.authenticated).toBe(true);
        expect(sessionBody.username).toBe(username);

        // Authorization integration: the issued session reaches a permission-
        // gated route (owner READ_DASHBOARD), while the same route is closed to
        // anonymous callers.
        const authorized = await request(port, "/api/sources", { cookie });
        expect(authorized.status).toBe(200);
        expect(JSON.parse(authorized.body).tenantId).toBe(sessionBody.tenantId);
        const anonymousSources = await request(port, "/api/sources");
        expect(anonymousSources.status).toBe(401);

        const logout = await request(port, "/api/auth/logout", { method: "POST", cookie });
        expect(logout.status).toBe(200);

        const afterLogout = await request(port, "/api/session", { cookie });
        expect(afterLogout.status).toBe(401);
    });
});
