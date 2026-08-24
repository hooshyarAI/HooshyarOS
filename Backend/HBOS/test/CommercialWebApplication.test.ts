import { createServer } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

function request(server: ReturnType<typeof createServer>, method: string, path: string, body?: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("runtime-address-unavailable"));
      const req = require("node:http").request({ hostname: "127.0.0.1", port: address.port, path, method, headers: body ? { "content-type": "application/json", "content-length": Buffer.byteLength(body) } : undefined }, (res: any) => {
        let payload = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => { payload += chunk; });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: payload }));
      });
      req.on("error", reject);
      if (body) req.write(body);
      req.end();
    });
  });
}

describe("Commercial Web Application", () => {
  test("proves runtime-to-application HTTP behavior", async () => {
    const server = createCommercialRuntimeServer();
    try {
      const health = await request(server, "GET", "/health");
      expect(health.status).toBe(200);
      expect(JSON.parse(health.body)).toMatchObject({ status: "ok" });

      server.close();
      const readyServer = createCommercialRuntimeServer();
      const ready = await request(readyServer, "GET", "/api/ready");
      expect(ready.status).toBe(200);
      expect(JSON.parse(ready.body)).toEqual({ status: "READY" });

      readyServer.close();
      const dashboardServer = createCommercialRuntimeServer();
      const dashboard = await request(dashboardServer, "GET", "/api/dashboard?organization=test");
      expect(dashboard.status).toBe(200);
      expect(JSON.parse(dashboard.body).metrics).toEqual({ revenue: 0, profit: 0, risk: 0 });

      dashboardServer.close();
      const sessionServer = createCommercialRuntimeServer();
      const session = await request(sessionServer, "POST", "/api/session", JSON.stringify({ username: "manager", organization: "Acme" }));
      expect(session.status).toBe(200);
      expect(JSON.parse(session.body)).toEqual({ organization: { name: "Acme" } });
      sessionServer.close();
    } finally {
      server.close();
    }
  });
});
