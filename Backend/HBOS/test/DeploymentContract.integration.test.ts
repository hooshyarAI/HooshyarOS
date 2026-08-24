import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DeploymentContractEngine } from "../Engines/DeploymentContractEngine";
import { CloudDeploymentEngine } from "../Engines/CloudDeploymentEngine";

describe("Deployment contract integration", () => {
  it("validates a local deployment contract and executes the repository deployment worker", async () => {
    const root = await mkdtemp(join(tmpdir(), "hooshyar-deployment-integration-"));
    const manifest = join(root, "deployment.json");
    const worker = join(root, "worker.py");
    try {
      await writeFile(manifest, JSON.stringify({ target: "local", artifact: "hooshyaros", healthCheck: "/health", rollback: "previous" }), "utf8");
      await writeFile(worker, "import sys\nprint('deployment-worker-ok')\nsys.exit(0)\n", "utf8");

      const contract = new DeploymentContractEngine().validate({
        target: "local",
        artifact: manifest,
        healthCheck: "/health",
        rollback: "previous",
      });
      const deployment = new CloudDeploymentEngine().deploy({ manifestPath: manifest, workerPath: worker, pythonExecutable: "python3" });

      expect(contract).toEqual({ valid: true, missing: [] });
      expect(deployment.ok).toBe(true);
      expect(deployment.provider).toBe("generic");
      expect(deployment.output).toContain("deployment-worker-ok");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
