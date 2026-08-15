import http from "node:http";

export interface CommercialRuntimeOptions {
  host?: string;
  port?: number;
}

export function createCommercialRuntimeServer(options: CommercialRuntimeOptions = {}) {
  const host = options.host ?? process.env.HOOSHYAR_HOST ?? "127.0.0.1";
  const port = options.port ?? Number(process.env.HOOSHYAR_PORT ?? 3000);

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ status: "ok", service: "HooshyarOS" }));
      return;
    }

    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "not_found" }));
  });

  return {
    server,
    host,
    port,
    start: () => new Promise<void>((resolve) => server.listen(port, host, () => resolve())),
    stop: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

if (require.main === module) {
  const runtime = createCommercialRuntimeServer();
  runtime.start().then(() => console.log(`HooshyarOS commercial runtime listening on ${runtime.host}:${runtime.port}`));
}
