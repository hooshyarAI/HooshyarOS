import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ProductionReadinessEngine } from "../Engines/ProductionReadinessEngine";

describe("ProductionReadinessEngine", () => {
    it("reports repository readiness and separates external validation", () => {
        const engine = new ProductionReadinessEngine();
        expect(engine.name).toBe("ProductionReadinessEngine");
        expect(engine.health()).toBe(true);
        const result = engine.audit(process.cwd());
        expect(result.ready).toBe(true);
        expect(result.missingArtifacts).toEqual([]);
        expect(result.invalidArtifacts).toEqual([]);
        expect(result.externalValidationRequired).toBe(true);
    });

    it("reports missing readiness evidence deterministically", () => {
        const root = join(process.cwd(), ".tmp-production-readiness-test");
        mkdirSync(root, { recursive: true });
        try {
            const result = new ProductionReadinessEngine().audit(root);
            expect(result.ready).toBe(false);
            expect(result.missingArtifacts).toContain("package.json");
            expect(result.missingArtifacts).toContain("Docs/ARCHITECTURE.md");
            expect(result.externalValidationRequired).toBe(true);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("rejects an invalid package script and malformed deployment controller", () => {
        const root = join(process.cwd(), ".tmp-production-readiness-invalid-test");
        mkdirSync(join(root, "Backend/HBOS/Assistant/Autonomous/Production"), { recursive: true });
        try {
            require("node:fs").writeFileSync(join(root, "package.json"), "{}", "utf8");
            const result = new ProductionReadinessEngine().audit(root);
            expect(result.invalidArtifacts).toContain("package.json: autonomous:build script");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
