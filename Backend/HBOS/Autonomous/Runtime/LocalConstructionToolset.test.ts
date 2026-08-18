import { declaredArtifactPaths, productRoadmapPaths, repositoryStateChanged } from "./LocalConstructionToolset";

describe("LocalConstructionToolset repository change detection", () => {
    it("reports a real working-tree change instead of trusting process success", () => {
        expect(repositoryStateChanged("", " M Backend/HBOS/Autonomous/Runtime/LocalConstructionToolset.ts")).toBe(true);
        expect(repositoryStateChanged("", "?? Backend/HBOS/Autonomous/Runtime/NewCapability.ts")).toBe(true);
    });

    it("does not report a change when repository state is unchanged", () => {
        expect(repositoryStateChanged("", "")).toBe(false);
        expect(repositoryStateChanged(" M existing.ts\n", " M existing.ts\n")).toBe(false);
    });

    it("maps repair capability ids to the canonical product roadmap boundary", () => {
        const root = process.cwd();
        const normalizePath = (path: string) => path.replace(`${root}\\`, "").split("\\").join("/");
        expect(productRoadmapPaths(root, "repair-product.financial-data-ingestion").map(normalizePath)).toEqual([
            "Backend/HBOS/Product/FinancialDataIngestionAdapter.ts",
            "Backend/HBOS/test/FinancialDataIngestionAdapter.test.ts",
            "Docs/Product/FinancialDataIngestionAdapter.md",
        ]);
    });

    it("does not fall back to the target engine path when a roadmap contract exists", () => {
        const root = process.cwd();
        const paths = declaredArtifactPaths(root, "repair-product.financial-data-ingestion", "Financial Intelligence Engine");
        expect(paths[0]?.split("\\").join("/")).toContain("/Backend/HBOS/Product/FinancialDataIngestionAdapter.ts");
        expect(paths[0]?.split("\\").join("/")).not.toContain("/Backend/HBOS/Engines/FinancialIntelligenceEngine.ts");
    });
});
