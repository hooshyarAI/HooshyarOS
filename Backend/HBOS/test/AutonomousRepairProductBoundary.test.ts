import { join } from "node:path";
import { declaredArtifactPaths, productRoadmapPaths } from "../Autonomous/Runtime/LocalConstructionToolset";

describe("Autonomous repair product boundary", () => {
    it("resolves repair-prefixed product capabilities to their durable product artifacts", () => {
        const root = process.cwd();
        const paths = productRoadmapPaths(root, "repair-product.financial-data-ingestion");
        expect(paths).toEqual([
            join(root, "Backend", "HBOS", "Product", "FinancialDataIngestionAdapter.ts"),
            join(root, "Backend", "HBOS", "test", "FinancialDataIngestionAdapter.test.ts"),
            join(root, "Docs", "Product", "FinancialDataIngestionAdapter.md")
        ]);
    });

    it("never falls back to the engine boundary for a known repair product capability", () => {
        const paths = declaredArtifactPaths(process.cwd(), "repair-product.financial-data-ingestion", "Financial Intelligence Engine");
        expect(paths.some(path => path.includes("Engines"))).toBe(false);
        expect(paths.every(path => path.includes("Product") || path.includes("FinancialDataIngestionAdapter.test.ts"))).toBe(true);
    });
});
