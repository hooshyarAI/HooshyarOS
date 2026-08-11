import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { SecurityAuditEngine } from "../Engines/SecurityAuditEngine";

describe("SecurityAuditEngine", () => {
    it("reports the governed repository security evidence as secure", () => {
        const engine = new SecurityAuditEngine();
        expect(engine.name).toBe("SecurityAuditEngine");
        expect(engine.health()).toBe(true);
        const result = engine.audit(process.cwd());
        expect(result.secure).toBe(true);
        expect(result.missingArtifacts).toEqual([]);
        expect(result.forbiddenArtifacts).toEqual([]);
    });

    it("reports missing security evidence deterministically", () => {
        const root = join(process.cwd(), ".tmp-security-audit-test");
        mkdirSync(root, { recursive: true });
        try {
            const result = new SecurityAuditEngine().audit(root);
            expect(result.secure).toBe(false);
            expect(result.missingArtifacts).toContain(".gitignore");
            expect(result.missingArtifacts).toContain("Backend/HBOS/Engines/SecurityLayerEngine.ts");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
