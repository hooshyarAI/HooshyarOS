import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("Autonomous development loop integrity", () => {
    it("contains exactly one canonical goal normalizer", () => {
        const sourcePath = join(process.cwd(), "Backend/HBOS/Architecture/Autonomous/AutonomousDevelopmentLoop.ts");
        expect(existsSync(sourcePath)).toBe(true);
        const source = readFileSync(sourcePath, "utf8");
        const implementations = source.match(/static\s+canonicalizeGoal\s*\(/g) ?? [];
        expect(implementations).toHaveLength(1);
    });

    it("maps repair-prefixed goals to their canonical capability identity", () => {
        const sourcePath = join(process.cwd(), "Backend/HBOS/Architecture/Autonomous/AutonomousDevelopmentLoop.ts");
        const source = readFileSync(sourcePath, "utf8");
        expect(source).toContain("capabilityId.startsWith(\"repair-\")");
        expect(source).toContain("capabilityId.slice(\"repair-\".length)");
    });
});
