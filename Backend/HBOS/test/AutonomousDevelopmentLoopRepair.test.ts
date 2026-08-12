import { AutonomousDevelopmentLoop } from "../Architecture/Autonomous/AutonomousDevelopmentLoop";

describe("AutonomousDevelopmentLoop repair goal canonicalization", () => {
    it("maps repair capability ids back to the canonical capability id", () => {
        expect(AutonomousDevelopmentLoop.canonicalizeGoal({
            capabilityId: "repair-product.financial-data-ingestion",
            capability: "repair and re-verify knot product.financial-data-ingestion",
            targetEngine: "Financial Intelligence Engine",
            dependencies: ["Knowledge Engine", "Financial Intelligence Engine"]
        })).toEqual(expect.objectContaining({
            capabilityId: "product.financial-data-ingestion"
        }));
    });

    it("does not alter normal capability ids", () => {
        const goal = {
            capabilityId: "product.financial-data-ingestion",
            capability: "ingest financial data",
            targetEngine: "Financial Intelligence Engine",
            dependencies: []
        };
        expect(AutonomousDevelopmentLoop.canonicalizeGoal(goal)).toBe(goal);
    });
});
