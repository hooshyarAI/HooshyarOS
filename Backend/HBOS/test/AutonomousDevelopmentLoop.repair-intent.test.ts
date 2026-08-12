import { AutonomousDevelopmentLoop } from "../Architecture/Autonomous/AutonomousDevelopmentLoop";

describe("AutonomousDevelopmentLoop repair intent", () => {
    it("preserves repair capability identity during goal canonicalization", () => {
        const repairGoal = {
            capabilityId: "repair-product.financial-data-ingestion",
            capability: "repair and re-verify knot product.financial-data-ingestion",
            targetEngine: "Financial Intelligence Engine",
            dependencies: ["Knowledge Engine", "Financial Intelligence Engine"]
        };

        const canonical = AutonomousDevelopmentLoop.canonicalizeGoal(repairGoal);

        expect(canonical.capabilityId).toBe("repair-product.financial-data-ingestion");
        expect(canonical.capabilityId.startsWith("repair-")).toBe(true);
    });
});
