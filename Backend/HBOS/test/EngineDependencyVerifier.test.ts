import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EngineDependencyVerifier } from "../Core/EngineDependencyVerifier";

describe("Engine Dependency Verification (Phase 03E)", () => {
    const CANONICAL_ENGINES = [
        "ReasoningEngine",
        "GovernanceEngine",
        "ExecutiveIntelligenceEngine",
        "OrganizationalIntelligenceEngine",
        "AutonomousOperationsEngine"
    ];

    let verifier: EngineDependencyVerifier;

    beforeEach(() => {
        verifier = new EngineDependencyVerifier();
    });

    it("discovers the real canonical engines directory (not an empty Core/Engines)", () => {
        expect(fs.existsSync(verifier.enginesDir)).toBe(true);
        expect(path.basename(verifier.enginesDir)).toBe("Engines");
        expect(fs.existsSync(path.join(verifier.enginesDir, "ReasoningEngine.ts"))).toBe(true);

        const analyses = verifier.analyzeDependencies();
        expect(analyses.length).toBeGreaterThanOrEqual(30);

        const names = analyses.map(a => a.engineName);
        for (const canonical of CANONICAL_ENGINES) {
            expect(names).toContain(canonical);
        }
    });

    it("resolves real engine-to-engine dependency edges", () => {
        const analyses = verifier.analyzeDependencies();
        const byName = new Map(analyses.map(a => [a.engineName, a]));

        const assistant = byName.get("AssistantEngine");
        expect(assistant).toBeDefined();
        expect(assistant!.importedEngines).toEqual(
            expect.arrayContaining(["DecisionEngine", "KnowledgeEngine", "IntelligenceEngine", "MemoryEngine"])
        );

        const organizational = byName.get("OrganizationalIntelligenceEngine");
        expect(organizational).toBeDefined();
        expect(organizational!.importedEngines).toEqual(
            expect.arrayContaining(["ReasoningEngine", "KnowledgeEngine", "MemoryEngine", "ProjectPilotEngine"])
        );

        const projectPilot = byName.get("ProjectPilotEngine");
        expect(projectPilot).toBeDefined();
        expect(projectPilot!.importedEngines).toEqual(
            expect.arrayContaining(["DecisionEngine", "MemoryEngine", "ReactionEngine"])
        );
    });

    it("detects no circular dependencies in the real engine ecosystem and cross-verifies the invariant", () => {
        const analyses = verifier.analyzeDependencies();

        expect(verifier.getCircularDependencies()).toEqual([]);
        for (const analysis of analyses) {
            expect(analysis.hasCircularDependency).toBe(false);
            expect(analysis.circularWith).toBeUndefined();
        }

        const edges = new Map(analyses.map(a => [a.engineName, a.importedEngines]));
        for (const [engineName, imports] of edges) {
            for (const imported of imports) {
                expect(edges.get(imported) ?? []).not.toContain(engineName);
            }
        }
    });

    it("classifies dependency direction against the real engine graph", () => {
        const analyses = verifier.analyzeDependencies();
        const byName = new Map(analyses.map(a => [a.engineName, a]));

        const reasoning = byName.get("ReasoningEngine");
        expect(reasoning).toBeDefined();
        expect(reasoning!.importedEngines).toEqual([]);
        expect(reasoning!.dependencyDirection).toBe("INBOUND");
        expect(reasoning!.status).toBe("WARNING");

        const assistant = byName.get("AssistantEngine");
        expect(assistant!.importedEngines.length).toBeGreaterThan(0);
        expect(assistant!.dependencyDirection).toBe("OUTBOUND");

        const memory = byName.get("MemoryEngine");
        expect(memory!.importedEngines).toContain("ReactionEngine");
        expect(memory!.dependencyDirection).toBe("NEUTRAL");
    });

    it("reports only genuinely bidirectional engines as conflicting directions", () => {
        const analyses = verifier.analyzeDependencies();
        const byName = new Map(analyses.map(a => [a.engineName, a]));
        const conflicts = verifier.getConflictingDirections();

        expect(conflicts.length).toBeGreaterThan(0);
        for (const conflict of conflicts) {
            const analysis = byName.get(conflict.engine);
            expect(analysis).toBeDefined();
            expect(analysis!.dependencyDirection).toBe("NEUTRAL");
            expect(analysis!.importedEngines.length).toBeGreaterThan(2);
        }
        expect(conflicts.map(c => c.engine)).toContain("OrganizationalIntelligenceEngine");
    });

    it("fails clearly when the target directory cannot be analyzed", () => {
        const missing = path.join(os.tmpdir(), `edv-missing-${process.pid}-${Date.now()}`);
        expect(() => new EngineDependencyVerifier(missing)).toThrow(
            /canonical engines directory not found/
        );

        const empty = fs.mkdtempSync(path.join(os.tmpdir(), "edv-empty-"));
        try {
            expect(() => new EngineDependencyVerifier(empty)).toThrow(
                /no engine files found/
            );
        } finally {
            fs.rmSync(empty, { recursive: true, force: true });
        }
    });

    it("analyzes a deterministic synthetic graph (circular + conflict fixture)", () => {
        const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "edv-fixture-"));
        const write = (name: string, body: string) =>
            fs.writeFileSync(path.join(fixture, name), body, "utf8");

        try {
            write("CycleAEngine.ts", 'import { CycleBEngine } from "./CycleBEngine";\nexport class CycleAEngine {}\n');
            write("CycleBEngine.ts", 'import { CycleAEngine } from "./CycleAEngine";\nexport class CycleBEngine {}\n');
            write("LeafEngine.ts", "export class LeafEngine {}\n");
            write("SoloEngine.ts", "export class SoloEngine {}\n");
            write(
                "HubEngine.ts",
                'import { CycleAEngine } from "./CycleAEngine";\n' +
                'import { LeafEngine } from "./LeafEngine";\n' +
                'import { SoloEngine } from "./SoloEngine";\n' +
                "export class HubEngine {}\n"
            );
            write("DependentEngine.ts", 'import { HubEngine } from "./HubEngine";\nexport class DependentEngine {}\n');

            const synthetic = new EngineDependencyVerifier(fixture);
            const analyses = synthetic.analyzeDependencies();
            const byName = new Map(analyses.map(a => [a.engineName, a]));

            expect(synthetic.getCircularDependencies()).toEqual(["CycleAEngine <-> CycleBEngine"]);
            expect(byName.get("CycleAEngine")!.hasCircularDependency).toBe(true);
            expect(byName.get("CycleAEngine")!.status).toBe("ERROR");

            expect(byName.get("HubEngine")!.dependencyDirection).toBe("NEUTRAL");
            expect(synthetic.getConflictingDirections()).toEqual([
                { engine: "HubEngine", direction: "NEUTRAL" }
            ]);

            expect(byName.get("LeafEngine")!.dependencyDirection).toBe("INBOUND");
            expect(byName.get("SoloEngine")!.importedEngines).toEqual([]);
        } finally {
            fs.rmSync(fixture, { recursive: true, force: true });
        }
    });
});
