import { relative, sep } from "node:path";
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
        const normalizePath = (path: string) => relative(root, path).split(sep).join("/");
        expect(productRoadmapPaths(root, "repair-product.financial-data-ingestion").map(normalizePath)).toEqual([
            "Backend/HBOS/Product/FinancialDataIngestionAdapter.ts",
            "Backend/HBOS/test/FinancialDataIngestionAdapter.test.ts",
            "Docs/Product/FinancialDataIngestionAdapter.md",
        ]);
    });

    it("does not fall back to the target engine path when a roadmap contract exists", () => {
        const root = process.cwd();
        const paths = declaredArtifactPaths(root, "repair-product.financial-data-ingestion", "Financial Intelligence Engine");
        const normalized = relative(root, paths[0] ?? "").split(sep).join("/");
        expect(normalized).toBe("Backend/HBOS/Product/FinancialDataIngestionAdapter.ts");
        expect(normalized).not.toBe("Backend/HBOS/Engines/FinancialIntelligenceEngine.ts");
    });
});
