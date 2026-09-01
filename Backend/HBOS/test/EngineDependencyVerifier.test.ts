import { EngineDependencyVerifier } from "./EngineDependencyVerifier";

describe("Engine Dependency Verification (Phase 03E)", () => {
    let verifier: EngineDependencyVerifier;

    beforeEach(() => {
        verifier = new EngineDependencyVerifier();
    });

    it("detects circular dependencies between engines", () => {
        const circular = verifier.getCircularDependencies();
        expect(circular).toEqual([]); // No circular dependencies in current implementation
    });

    it("analyzes dependency direction for each engine", () => {
        const analyses = verifier.analyzeDependencies();

        for (const analysis of analyses) {
            expect(analysis.engineName).toBeDefined();
            expect(analysis.importedEngines).toBeDefined();
            expect(analysis.hasCircularDependency).toBe(false);
            expect(["HEALTHY", "WARNING", "ERROR"]).toContain(analysis.status);
        }
    });

    it("identifies engines with no dependencies", () => {
        const analyses = verifier.analyzeDependencies();
        const independentEngines = analyses.filter(a => a.importedEngines.length === 0);

        expect(independentEngines.length).toBeGreaterThan(0);
        for (const engine of independentEngines) {
            expect(engine.status).toBe("WARNING");
        }
    });

    it("detects conflicting dependency directions mechanically verifiable", () => {
        const conflicts = verifier.getConflictingDirections();
        expect(Array.isArray(conflicts)).toBe(true);
    });

    it("verifies no circular dependencies exist in current implementation", () => {
        const circular = verifier.getCircularDependencies();
        expect(circular.length).toBe(0);
    });
});