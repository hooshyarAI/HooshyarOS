import { HealthMonitorEngine, HealthStatus, HealthEvent } from "../Engines/HealthMonitorEngine";
import { Engine } from "../Core/Engine";

function makeEngine(name: string, healthy: boolean = true): Engine {
    return {
        name,
        initialize(): void {},
        health(): boolean {
            return healthy;
        }
    };
}

describe("HealthMonitorEngine Phase 11-1.1", () => {
    let monitor: HealthMonitorEngine;

    beforeEach(() => {
        monitor = new HealthMonitorEngine();
        monitor.initialize();
    });

    describe("Engine interface compliance", () => {
        it("has name = HealthMonitorEngine", () => {
            expect(monitor.name).toBe("HealthMonitorEngine");
        });

        it("implements initialize()", () => {
            expect(() => monitor.initialize()).not.toThrow();
        });

        it("implements health() returning boolean", () => {
            expect(typeof monitor.health()).toBe("boolean");
        });
    });

    describe("registerEngine / unregisterEngine / getEngine / getAllEngines", () => {
        it("registerEngine adds engine to registry", () => {
            const engine = makeEngine("TestEngine");
            monitor.registerEngine(engine);
            expect(monitor.getEngine("TestEngine")).toBe(engine);
        });

        it("unregisterEngine removes engine from registry", () => {
            const engine = makeEngine("TestEngine");
            monitor.registerEngine(engine);
            monitor.unregisterEngine("TestEngine");
            expect(monitor.getEngine("TestEngine")).toBeUndefined();
        });

        it("getEngine returns undefined for unknown name", () => {
            expect(monitor.getEngine("UnknownEngine")).toBeUndefined();
        });

        it("getAllEngines returns all registered engines", () => {
            const e1 = makeEngine("EngineA");
            const e2 = makeEngine("EngineB");
            monitor.registerEngine(e1);
            monitor.registerEngine(e2);
            expect(monitor.getAllEngines()).toHaveLength(2);
            expect(monitor.getAllEngines()).toContain(e1);
            expect(monitor.getAllEngines()).toContain(e2);
        });

        it("duplicate registration throws", () => {
            const engine = makeEngine("DuplicateEngine");
            monitor.registerEngine(engine);
            expect(() => monitor.registerEngine(engine)).toThrow("DuplicateEngine already registered");
        });

        it("unregister non-existent engine does not throw", () => {
            expect(() => monitor.unregisterEngine("NonExistent")).not.toThrow();
        });
    });

    describe("getEngineHealth", () => {
        it("returns correct structure for registered engine", () => {
            const engine = makeEngine("HealthTestEngine");
            monitor.registerEngine(engine);
            const status = monitor.getEngineHealth("HealthTestEngine");
            expect(status).toBeDefined();
            expect(status!.name).toBe("HealthTestEngine");
            expect(typeof status!.healthy).toBe("boolean");
            expect(typeof status!.lastCheck).toBe("string");
        });

        it("returns undefined for unregistered engine", () => {
            expect(monitor.getEngineHealth("Unknown")).toBeUndefined();
        });
    });

    describe("getAllHealth", () => {
        it("returns array of all engines health", () => {
            const e1 = makeEngine("EngineA");
            const e2 = makeEngine("EngineB");
            monitor.registerEngine(e1);
            monitor.registerEngine(e2);
            const all = monitor.getAllHealth();
            expect(all).toHaveLength(2);
            expect(all.map((s) => s.name)).toContain("EngineA");
            expect(all.map((s) => s.name)).toContain("EngineB");
        });

        it("returns empty array when no engines registered", () => {
            expect(monitor.getAllHealth()).toHaveLength(0);
        });
    });

    describe("checkAll", () => {
        it("runs health() on all engines and returns results", () => {
            const e1 = makeEngine("EngineA", true);
            const e2 = makeEngine("EngineB", true);
            monitor.registerEngine(e1);
            monitor.registerEngine(e2);
            const results = monitor.checkAll();
            expect(results).toHaveLength(2);
            expect(results.every((r) => r.healthy)).toBe(true);
        });

        it("returns WARNING when health() returns false", () => {
            const unhealthy = makeEngine("UnhealthyEngine", false);
            monitor.registerEngine(unhealthy);
            const events: HealthEvent[] = [];
            monitor.onHealthEvent((e) => events.push(e));
            const results = monitor.checkAll();
            expect(results.some((r) => r.name === "UnhealthyEngine" && !r.healthy)).toBe(true);
            expect(events.some((e) => e.level === "WARNING")).toBe(true);
        });

        it("returns CRITICAL when engine throws during health()", () => {
            const throwingEngine: Engine = {
                name: "ThrowingEngine",
                initialize(): void {},
                health(): boolean {
                    throw new Error("Health check failed");
                }
            };
            monitor.registerEngine(throwingEngine);
            const events: HealthEvent[] = [];
            monitor.onHealthEvent((e) => events.push(e));
            const results = monitor.checkAll();
            expect(results.some((r) => r.name === "ThrowingEngine" && !r.healthy)).toBe(true);
            expect(events.some((e) => e.level === "CRITICAL")).toBe(true);
        });

        it("generates traceId for each health check", () => {
            const e1 = makeEngine("EngineA");
            const e2 = makeEngine("EngineB");
            monitor.registerEngine(e1);
            monitor.registerEngine(e2);
            const events: HealthEvent[] = [];
            monitor.onHealthEvent((e) => events.push(e));
            monitor.checkAll();
            expect(events).toHaveLength(2);
            expect(events[0].traceId).toMatch(/^TRACE-/);
            expect(events[1].traceId).toMatch(/^TRACE-/);
            expect(events[0].traceId).not.toBe(events[1].traceId);
        });
    });

    describe("11+ canonical engines registration", () => {
        const canonicalNames = [
            "ReasoningEngine",
            "GovernanceEngine",
            "ExecutiveIntelligenceEngine",
            "OrganizationalIntelligenceEngine",
            "AutonomousOperationsEngine",
            "MemoryEngine",
            "KnowledgeEngine",
            "DecisionEngine",
            "AssistantEngine",
            "ProjectPilotEngine",
            "ReactionEngine",
            "SecurityLayerEngine",
            "SecurityAuditEngine",
            "IntelligenceEngine",
            "FinancialIntelligenceEngine",
            "ReportsEngine",
            "DashboardEngine",
            "BudgetIntelligenceEngine",
            "TaxIntelligenceEngine",
            "RiskIntelligenceEngine",
            "APIGatewayEngine",
            "CloudDeploymentEngine",
            "ProductionReadinessEngine",
            "DeploymentReadinessEngine"
        ];

        it("all canonical engines can register and report health", () => {
            canonicalNames.forEach((name) => {
                monitor.registerEngine(makeEngine(name));
            });
            expect(monitor.getAllEngines()).toHaveLength(canonicalNames.length);
            const results = monitor.checkAll();
            expect(results).toHaveLength(canonicalNames.length);
            expect(results.every((r) => r.healthy)).toBe(true);
        });
    });

    describe("backward compatibility", () => {
        it("existing engines without explicit implements still work", () => {
            const legacyEngine = {
                name: "LegacyEngine",
                initialize(): void { console.log("Legacy started"); },
                health(): boolean { return true; }
            };
            monitor.registerEngine(legacyEngine);
            expect(monitor.getEngine("LegacyEngine")).toBe(legacyEngine);
            expect(monitor.health()).toBe(true);
        });
    });

    describe("edge cases", () => {
        it("empty registry: checkAll returns empty array", () => {
            expect(monitor.checkAll()).toHaveLength(0);
        });

        it("empty registry: health() returns true", () => {
            expect(monitor.health()).toBe(true);
        });

        it("unregister then re-register same engine works", () => {
            const engine = makeEngine("ReRegisterEngine");
            monitor.registerEngine(engine);
            monitor.unregisterEngine("ReRegisterEngine");
            expect(() => monitor.registerEngine(engine)).not.toThrow();
            expect(monitor.getEngine("ReRegisterEngine")).toBe(engine);
        });
    });
});
