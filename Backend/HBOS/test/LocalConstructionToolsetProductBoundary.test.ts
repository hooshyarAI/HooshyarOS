import { createLocalConstructionTools, evaluateBehavioralEvidence } from "../Autonomous/Runtime/LocalConstructionToolset";

describe("LocalConstructionToolset product artifact boundary", () => {
    it("resolves a repair-product goal to the canonical product artifact paths", () => {
        const architecture = createLocalConstructionTools(process.cwd()).find(tool => tool.name === "architecture");
        expect(architecture).toBeDefined();

        const result = architecture!.execute("ARCHITECTURE", {
            plan: {
                capabilityId: "product.financial-data-ingestion",
                capability: "repair and re-verify knot product.financial-data-ingestion",
                targetEngine: "Financial Intelligence Engine",
                dependencies: ["Knowledge Engine", "Financial Intelligence Engine"],
                architectureRules: []
            },
            stage: "ARCHITECTURE",
            attempt: 1,
            artifacts: {},
            issues: []
        });

        expect(result.ok).toBe(true);
        expect(result.artifact).toEqual(expect.objectContaining({
            requiredPaths: expect.arrayContaining([
                expect.stringContaining("Backend"),
                expect.stringContaining("Product"),
                expect.stringContaining("FinancialDataIngestionAdapter.ts")
            ])
        }));
    });

    it("derives behavioral evidence from commercial artifact quality for a repaired product capability", () => {
        const result = evaluateBehavioralEvidence(
            process.cwd(),
            "repair-product.financial-statement-analysis",
            true,
            ""
        );

        expect(result.source).toBe("commercial-artifact-quality");
        expect(result.verified).toBe(true);
        expect(result.failures).toEqual([]);
    });
});
