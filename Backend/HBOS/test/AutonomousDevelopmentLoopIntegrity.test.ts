import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AutonomousDevelopmentLoop } from "../Architecture/Autonomous/AutonomousDevelopmentLoop";

describe("Autonomous development loop integrity", () => {
    it("contains exactly one canonical goal normalizer", () => {
        const sourcePath = join(process.cwd(), "Backend/HBOS/Architecture/Autonomous/AutonomousDevelopmentLoop.ts");
        expect(existsSync(sourcePath)).toBe(true);
        const source = readFileSync(sourcePath, "utf8");
        const implementations = source.match(/static\s+canonicalizeGoal\s*\(/g) ?? [];
        expect(implementations).toHaveLength(1);
    });

    it("preserves repair-prefixed capability identity during canonicalization", () => {
        const repairGoal = {
            capabilityId: "repair-product.financial-data-ingestion",
            capability: "repair and re-verify knot product.financial-data-ingestion"
        };

        const canonical = AutonomousDevelopmentLoop.canonicalizeGoal(repairGoal);

        expect(canonical.capabilityId).toBe("repair-product.financial-data-ingestion");
        expect(canonical.capabilityId.startsWith("repair-")).toBe(true);
    });
});
