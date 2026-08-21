import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface CommercialRuntimeOptions {
  host?: string;
  port?: number;
}

const WEB_ROOT = join(process.cwd(), "web");

function send(res: ServerResponse, status: number, contentType: string, body: string): void {
  res.writeHead(status, { "content-type": contentType });
  res.end(body);
}

function json(res: ServerResponse, status: number, value: unknown): void {
  send(res, status, "application/json; charset=utf-8", JSON.stringify(value));
}

export function createCommercialRuntimeServer(options: CommercialRuntimeOptions = {}) {
  const host = options.host ?? process.env.HOOSHYAR_HOST ?? "127.0.0.1";
  const port = options.port ?? Number(process.env.HOOSHYAR_PORT ?? 3000);

  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", `http://${host}`);

    if (method === "GET" && url.pathname === "/health") {
      return json(res, 200, { status: "ok", service: "HooshyarOS" });
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
          return json(res, 200, {
            organization: { name: String(payload.organization ?? "شرکت نمونه هوشیار") },
          });
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

    return json(res, 404, { error: "NOT_FOUND" });
  });

  return Object.assign(server, {
    host,
    port,
    start: () => new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, host, () => {
        server.removeListener("error", reject);
        resolve();
      });
    }),
    stop: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    }),
  });
}

if (require.main === module) {
  const runtime = createCommercialRuntimeServer();
  runtime.start().then(() => console.log(`HooshyarOS commercial runtime listening on ${runtime.host}:${runtime.port}`));
}
