import { createServer } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

function request(server: ReturnType<typeof createServer>, method: string, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("runtime-address-unavailable"));
      const req = require("node:http").request({ hostname: "127.0.0.1", port: address.port, path, method }, (res: any) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => { body += chunk; });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      });
      req.on("error", reject);
      req.end();
    });
  });
}

describe("CommercialRuntimeServer", () => {
  test("serves health and rejects unknown routes", async () => {
    const server = createCommercialRuntimeServer();
    try {
      const health = await request(server, "GET", "/health");
      expect(health.status).toBe(200);
      expect(JSON.parse(health.body)).toEqual({ status: "ok", service: "hooshyar-commercial-runtime" });

      server.close();
      const unknownServer = createCommercialRuntimeServer();
      try {
        const unknown = await request(unknownServer, "GET", "/does-not-exist");
        expect(unknown.status).toBe(404);
        expect(JSON.parse(unknown.body)).toEqual({ error: "NOT_FOUND" });
      } finally {
        unknownServer.close();
      }
    } finally {
      server.close();
    }
  });
});
