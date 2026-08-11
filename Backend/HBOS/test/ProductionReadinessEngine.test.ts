import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ProductionReadinessEngine } from "../Engines/ProductionReadinessEngine";

describe("ProductionReadinessEngine", () => {
    it("reports a repository as ready when the governed evidence set exists", () => {
        const engine = new ProductionReadinessEngine();
        expect(engine.name).toBe("ProductionReadinessEngine");
        expect(engine.health()).toBe(true);
        const result = engine.audit(process.cwd());
        expect(result.ready).toBe(true);
        expect(result.missingArtifacts).toEqual([]);
    });

    it("reports missing readiness evidence deterministically", () => {
        const root = join(process.cwd(), ".tmp-production-readiness-test");
        mkdirSync(root, { recursive: true });
        try {
            const result = new ProductionReadinessEngine().audit(root);
            expect(result.ready).toBe(false);
            expect(result.missingArtifacts).toContain("package.json");
            expect(result.missingArtifacts).toContain("Docs/ARCHITECTURE.md");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
