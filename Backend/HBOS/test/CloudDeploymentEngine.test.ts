import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CloudDeploymentEngine } from "../Engines/CloudDeploymentEngine";

describe("CloudDeploymentEngine", () => {
    it("rejects a missing manifest", () => {
        const result = new CloudDeploymentEngine().deploy({ manifestPath: join(process.cwd(), "missing-cloud-manifest.json") });
        expect(result.ok).toBe(false);
        expect(result.returnCode).toBe(3);
    });

    it("delegates a valid deployment manifest to the Python worker", () => {
        const root = mkdtempSync(join(process.cwd(), "tmp-cloud-deploy-"));
        const script = join(root, "fake_worker.py");
        const manifest = join(root, "manifest.json");
        try {
            writeFileSync(script, "import sys; print('{\"ok\": true, \"provider\": \"test\"}')", "utf8");
            writeFileSync(manifest, JSON.stringify({ provider: "test", command: ["echo", "ready"] }), "utf8");
            const result = new CloudDeploymentEngine().deploy({ manifestPath: manifest, workerPath: script });
            expect(result.provider).toBe("generic");
            expect(result.ok).toBe(true);
            expect(result.returnCode).toBe(0);
            expect(result.output).toContain("ok");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
