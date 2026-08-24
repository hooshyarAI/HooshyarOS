import { request } from "node:http";
import { createCommercialRuntimeServer } from "../../Autonomous/Runtime/CommercialRuntimeServer";
import { HealthMonitorEngine } from "./HealthMonitorEngine";
import { EngineLifecycleManager } from "../Lifecycle/EngineLifecycleManager";
import { EngineLifecycleStatus } from "../Lifecycle/EngineLifecycleStatus";

describe("Commercial observability integration", () => {
  test("connects runtime health behavior with repository health monitoring", async () => {
    const lifecycle = new EngineLifecycleManager();
    lifecycle.registerEngine("Commercial Runtime");
    lifecycle.updateStatus("Commercial Runtime", EngineLifecycleStatus.RUNNING);
    const report = new HealthMonitorEngine(lifecycle).generateReport(["Commercial Runtime"]);

    const server = createCommercialRuntimeServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });

    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("runtime-address-unavailable");
      const health = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        const req = request({ hostname: "127.0.0.1", port: address.port, path: "/health", method: "GET" }, (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", chunk => { body += chunk; });
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
        });
        req.on("error", reject);
        req.end();
      });

      expect(report.system).toBe("READY");
      expect(report.engines[0].healthy).toBe(true);
      expect(health.status).toBe(200);
      expect(JSON.parse(health.body)).toEqual({ status: "ok", service: "hooshyar-commercial-runtime" });
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
