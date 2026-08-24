import { createServer } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

function request(
  server: ReturnType<typeof createServer>,
  method: string,
  path: string,
  body?: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        return reject(new Error("runtime-address-unavailable"));
      }
      const req = require("node:http").request(
        {
          hostname: "127.0.0.1",
          port: address.port,
          path,
          method,
          headers: body ? { "content-type": "application/json" } : undefined,
        },
        (res: any) => {
          let payload = "";
          res.setEncoding("utf8");
          res.on("data", (chunk: string) => { payload += chunk; });
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body: payload }));
        },
      );
      req.on("error", reject);
      if (body) req.write(body);
      req.end();
    });
  });
}

describe("CommercialRuntimeApplication", () => {
  test("serves the commercial readiness, dashboard, and session application contracts", async () => {
    const server = createCommercialRuntimeServer();
    try {
      const ready = await request(server, "GET", "/api/ready");
      expect(ready.status).toBe(200);
      expect(JSON.parse(ready.body)).toEqual({ status: "READY" });

      const dashboard = await request(server, "GET", "/api/dashboard");
      expect(dashboard.status).toBe(200);
      expect(JSON.parse(dashboard.body)).toEqual({ metrics: { revenue: 0, profit: 0, risk: 0 } });

      const session = await request(server, "POST", "/api/session", JSON.stringify({ organization: "آزمایشگاه هوشیار" }));
      expect(session.status).toBe(200);
      expect(JSON.parse(session.body)).toEqual({ organization: { name: "آزمایشگاه هوشیار" } });

      const invalidSession = await request(server, "POST", "/api/session", "{invalid-json");
      expect(invalidSession.status).toBe(400);
      expect(JSON.parse(invalidSession.body)).toEqual({ error: "INVALID_JSON" });
    } finally {
      server.close();
    }
  });
});
