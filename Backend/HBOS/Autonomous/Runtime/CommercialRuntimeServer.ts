import { createServer, IncomingMessage, ServerResponse, Server } from "node:http";

const send = (res: ServerResponse, status: number, contentType: string, body: string) => {
    res.statusCode = status;
    res.setHeader("Content-Type", contentType);
    res.end(body);
};

export function createCommercialRuntimeServer(): Server {
    return createServer((req: IncomingMessage, res: ServerResponse) => {
        const path = req.url?.split("?")[0] ?? "/";
        if (path === "/health") return send(res, 200, "application/json; charset=utf-8", JSON.stringify({ status: "ok", service: "hooshyar-commercial-runtime" }));
        if (path === "/") return send(res, 200, "text/html; charset=utf-8", "<!doctype html><html lang=\"fa\"><head><meta charset=\"utf-8\"><title>هوشیار.ai</title><link rel=\"stylesheet\" href=\"/styles.css\"></head><body><main><h1>هوشیار.ai</h1><script src=\"/app.js\"></script></main></body></html>");
        if (path === "/app.js") return send(res, 200, "text/javascript; charset=utf-8", "fetch('/api/session'); fetch('/api/dashboard');");
        if (path === "/styles.css") return send(res, 200, "text/css; charset=utf-8", "@media (min-width: 1px) { body { font-family: sans-serif; } }");
        if (path === "/manifest.webmanifest") return send(res, 200, "application/manifest+json; charset=utf-8", JSON.stringify({ name: "Hooshyar.ai", start_url: "/" }));
        if (path === "/api/session") return send(res, 200, "application/json; charset=utf-8", JSON.stringify({ authenticated: false }));
        if (path === "/api/dashboard") return send(res, 200, "application/json; charset=utf-8", JSON.stringify({ status: "ready" }));
        return send(res, 404, "application/json; charset=utf-8", JSON.stringify({ error: "NOT_FOUND" }));
    });
}
