import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DeploymentReadinessEngine } from "../Engines/DeploymentReadinessEngine";

function write(root: string, relative: string, content = "ok"): void {
    const path = join(root, relative);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, content, "utf8");
}

describe("DeploymentReadinessEngine", () => {
    it("reports readiness when deployment evidence exists", () => {
        const root = mkdtempSync(join(process.cwd(), "tmp-deployment-ready-"));
        try {
            [
                "package.json",
                "tsconfig.json",
                "jest.config.js",
                "Docs/ROADMAP.md"
            ].forEach(file => write(root, file));
            write(root, "Backend/HBOS/Assistant/Autonomous/Production/DeploymentController.ts", "export class DeploymentController { deploy(){ return { deployment: true }; } }");

            const engine = new DeploymentReadinessEngine();
            const result = engine.audit(root);

            expect(engine.health()).toBe(true);
            expect(result.ready).toBe(true);
            expect(result.missingArtifacts).toEqual([]);
            expect(result.invalidArtifacts).toEqual([]);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("reports missing or invalid deployment evidence deterministically", () => {
        const root = mkdtempSync(join(process.cwd(), "tmp-deployment-missing-"));
        try {
            write(root, "package.json");
            const result = new DeploymentReadinessEngine().audit(root);

            expect(result.ready).toBe(false);
            expect(result.missingArtifacts).toContain("tsconfig.json");
            expect(result.missingArtifacts).toContain("Backend/HBOS/Assistant/Autonomous/Production/DeploymentController.ts");
            expect(result.invalidArtifacts).toEqual([]);

            write(root, "tsconfig.json");
            write(root, "jest.config.js");
            write(root, "Docs/ROADMAP.md");
            write(root, "Backend/HBOS/Assistant/Autonomous/Production/DeploymentController.ts", "export class WrongController {};");

            const invalid = new DeploymentReadinessEngine().audit(root);
            expect(invalid.ready).toBe(false);
            expect(invalid.invalidArtifacts).toContain("Backend/HBOS/Assistant/Autonomous/Production/DeploymentController.ts");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
