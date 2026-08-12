import { PerformanceTestingEngine } from "../Engines/PerformanceTestingEngine";

describe("PerformanceTestingEngine", () => {
    it("reports repository-native performance evidence when all governed artifacts exist", () => {
        const engine = new PerformanceTestingEngine();
        expect(engine.name).toBe("PerformanceTestingEngine");
        expect(engine.health()).toBe(true);
        const result = engine.audit(process.cwd());
        expect(result.ready).toBe(true);
        expect(result.missingArtifacts).toEqual([]);
    });

    it("reports missing performance evidence deterministically", () => {
        const root = ".tmp-performance-testing-test";
        const result = new PerformanceTestingEngine().audit(root);
        expect(result.ready).toBe(false);
        expect(result.missingArtifacts).toContain("package.json");
        expect(result.missingArtifacts).toContain("Backend/AI_Runtime/performance/performance_engine.py");
    });
});
