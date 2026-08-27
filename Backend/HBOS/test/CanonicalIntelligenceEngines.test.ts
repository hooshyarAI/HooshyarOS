import { HBOS } from "../Core/HBOS";
import { EngineRegistry } from "../Core/EngineRegistry";

const CANONICAL_INTELLIGENCE_ENGINES = [
    "ReasoningEngine",
    "GovernanceEngine",
    "ExecutiveIntelligenceEngine",
    "OrganizationalIntelligenceEngine",
    "AutonomousOperationsEngine",
];

describe("Canonical Intelligence Engines registration", () => {
    test("HBOS uses the canonical Core/EngineRegistry", () => {
        const registry = new EngineRegistry();
        expect(typeof registry.register).toBe("function");
        expect(typeof registry.initializeAll).toBe("function");
        expect(typeof registry.healthReport).toBe("function");
        expect(typeof registry.getEngine).toBe("function");
    });

    test("all five canonical intelligence engines are registered in HBOS", () => {
        const hbos = new HBOS();
        hbos.boot();

        const names = hbos.health().map((engine) => engine.name);

        for (const expected of CANONICAL_INTELLIGENCE_ENGINES) {
            expect(names).toContain(expected);
        }
    });

    test("every registered engine initializes and reports healthy", () => {
        const hbos = new HBOS();
        expect(hbos.boot()).toBe(true);

        const report = hbos.health();
        expect(report.length).toBeGreaterThanOrEqual(6);

        for (const engine of report) {
            expect(engine.healthy).toBe(true);
        }

        for (const expected of CANONICAL_INTELLIGENCE_ENGINES) {
            const engine = report.find((e) => e.name === expected);
            expect(engine).toBeDefined();
            expect(engine?.healthy).toBe(true);
        }
    });

    test("no duplicate engine ownership is introduced", () => {
        const hbos = new HBOS();
        hbos.boot();

        const names = hbos.health().map((engine) => engine.name);
        const unique = new Set(names);

        expect(unique.size).toBe(names.length);

        for (const expected of CANONICAL_INTELLIGENCE_ENGINES) {
            expect(names.filter((n) => n === expected).length).toBe(1);
        }
    });
});
