import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";
import { request } from "node:http";
import type { Server } from "node:http";

function start(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("runtime-address-unavailable"));
      resolve(address.port);
    });
  });
}

function requestJson(port: number, method: string, path: string, body?: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({
      hostname: "127.0.0.1",
      port,
      path,
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
    }, (res) => {
      let payload = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { payload += chunk; });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: payload }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

describe("CommercialRuntimeApplication", () => {
  test("serves the commercial readiness, dashboard, and session application contracts", async () => {
    const server = createCommercialRuntimeServer();
    const port = await start(server);
    try {
      const ready = await requestJson(port, "GET", "/api/ready");
      expect(ready.status).toBe(200);
      expect(JSON.parse(ready.body)).toEqual({ status: "READY" });

      const dashboard = await requestJson(port, "GET", "/api/dashboard");
      expect(dashboard.status).toBe(200);
      expect(JSON.parse(dashboard.body)).toEqual({ metrics: { revenue: 0, profit: 0, risk: 0 } });

      const session = await requestJson(port, "POST", "/api/session", JSON.stringify({ organization: "آزمایشگاه هوشیار" }));
      expect(session.status).toBe(200);
      expect(JSON.parse(session.body)).toEqual({ organization: { name: "آزمایشگاه هوشیار" } });

      const invalidSession = await requestJson(port, "POST", "/api/session", "{invalid-json");
      expect(invalidSession.status).toBe(400);
      expect(JSON.parse(invalidSession.body)).toEqual({ error: "INVALID_JSON" });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
