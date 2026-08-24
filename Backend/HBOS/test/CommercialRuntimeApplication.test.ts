import { createServer } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

function request(server: ReturnType<typeof createServer>, method: string, path: string, body?: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("runtime-address-unavailable"));
      const headers = body ? { "content-type": "application/json", "content-length": Buffer.byteLength(body) } : undefined;
      const req = require("node:http").request({ hostname: "127.0.0.1", port: address.port, path, method, headers }, (res: any) => {
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

describe("CommercialRuntimeApplication", () => {
  test("connects readiness and session application flows over HTTP", async () => {
    const server = createCommercialRuntimeServer();
    try {
      const ready = await request(server, "GET", "/api/ready");
      expect(ready.status).toBe(200);
      expect(JSON.parse(ready.body)).toEqual({ status: "READY" });

      server.close();
      const sessionServer = createCommercialRuntimeServer();
      try {
        const session = await request(sessionServer, "POST", "/api/session", JSON.stringify({ organization: "Acme" }));
        expect(session.status).toBe(200);
        expect(JSON.parse(session.body)).toEqual({ organization: { name: "Acme" } });
      } finally {
        sessionServer.close();
      }
    } finally {
      server.close();
    }
  });
});
