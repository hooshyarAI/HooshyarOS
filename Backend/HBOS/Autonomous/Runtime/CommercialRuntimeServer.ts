import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(process.cwd(), "web");

function send(res: ServerResponse, status: number, contentType: string, body: string): void {
  res.writeHead(status, { "content-type": contentType });
  res.end(body);
}

function json(res: ServerResponse, status: number, value: unknown): void {
  send(res, status, "application/json; charset=utf-8", JSON.stringify(value));
}

export function createCommercialRuntimeServer() {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    if (method === "GET" && url.pathname === "/health") {
      return json(res, 200, { status: "ok", service: "hooshyar-commercial-runtime" });
    }
    if (method === "GET" && url.pathname === "/api/ready") {
      return json(res, 200, { status: "READY" });
    }
    if (method === "GET" && url.pathname === "/api/dashboard") {
      return json(res, 200, { metrics: { revenue: 0, profit: 0, risk: 0 } });
    }
    if (method === "POST" && url.pathname === "/api/session") {
      let body = "";
      req.setEncoding("utf8");
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => {
        try {
          const payload = JSON.parse(body || "{}");
          return json(res, 200, { organization: { name: String(payload.organization ?? "شرکت نمونه هوشیار") } });
        } catch {
          return json(res, 400, { error: "INVALID_JSON" });
        }
      });
      return;
    }

    const assets: Record<string, [string, string]> = {
      "/": ["index.html", "text/html; charset=utf-8"],
      "/app.js": ["app.js", "text/javascript; charset=utf-8"],
      "/styles.css": ["styles.css", "text/css; charset=utf-8"],
      "/manifest.webmanifest": ["manifest.webmanifest", "application/manifest+json; charset=utf-8"],
    };
    const asset = assets[url.pathname];
    if (method === "GET" && asset) {
      const file = join(WEB_ROOT, asset[0]);
      if (!existsSync(file)) return send(res, 404, "text/plain; charset=utf-8", "NOT_FOUND");
      return send(res, 200, asset[1], readFileSync(file, "utf8"));
    }
    return send(res, 404, "application/json; charset=utf-8", JSON.stringify({ error: "NOT_FOUND" }));
  });
}
