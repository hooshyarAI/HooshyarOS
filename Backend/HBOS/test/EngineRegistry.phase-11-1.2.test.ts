import { EngineRegistry } from "../Engines/EngineRegistry";
import { LifecycleManager } from "../Engines/LifecycleManager";
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

describe("EngineRegistry Phase 11-1.2", () => {
    beforeEach(() => {
        EngineRegistry.resetInstance();
        LifecycleManager.resetInstance();
    });

    describe("singleton behavior", () => {
        it("getInstance returns same instance on repeated calls", () => {
            const a = EngineRegistry.getInstance();
            const b = EngineRegistry.getInstance();
            expect(a).toBe(b);
        });

        it("resetInstance clears state and returns new instance on next getInstance", () => {
            const a = EngineRegistry.getInstance();
            a.register(makeEngine("SingletonEngine"));
            EngineRegistry.resetInstance();
            const b = EngineRegistry.getInstance();
            expect(b).not.toBe(a);
            expect(b.getAllEngines()).toHaveLength(0);
        });
    });

    describe("register / unregister / getEngine / getAllEngines", () => {
        it("register adds engine to registry", () => {
            const engine = makeEngine("TestEngine");
            EngineRegistry.getInstance().register(engine);
            expect(EngineRegistry.getInstance().getEngine("TestEngine")).toBe(engine);
        });

        it("unregister removes engine from registry", () => {
            const engine = makeEngine("TestEngine");
            const registry = EngineRegistry.getInstance();
            registry.register(engine);
            registry.unregister("TestEngine");
            expect(registry.getEngine("TestEngine")).toBeUndefined();
        });

        it("getEngine returns undefined for unknown name", () => {
            expect(EngineRegistry.getInstance().getEngine("UnknownEngine")).toBeUndefined();
        });

        it("getAllEngines returns all registered engines", () => {
            const e1 = makeEngine("EngineA");
            const e2 = makeEngine("EngineB");
            const registry = EngineRegistry.getInstance();
            registry.register(e1);
            registry.register(e2);
            expect(registry.getAllEngines()).toHaveLength(2);
            expect(registry.getAllEngines()).toContain(e1);
            expect(registry.getAllEngines()).toContain(e2);
        });

        it("duplicate registration throws", () => {
            const engine = makeEngine("DuplicateEngine");
            const registry = EngineRegistry.getInstance();
            registry.register(engine);
            expect(() => registry.register(engine)).toThrow("DuplicateEngine already registered");
        });

        it("unregister non-existent engine does not throw", () => {
            expect(() => EngineRegistry.getInstance().unregister("NonExistent")).not.toThrow();
        });
    });

    describe("healthCheckAll", () => {
        it("runs health() on all registered engines and returns results", () => {
            const e1 = makeEngine("EngineA", true);
            const e2 = makeEngine("EngineB", true);
            const registry = EngineRegistry.getInstance();
            registry.register(e1);
            registry.register(e2);
            const results = registry.healthCheckAll();
            expect(results).toHaveLength(2);
            expect(results.every((r) => r.healthy)).toBe(true);
        });

        it("returns correct structure with name, healthy, and lastCheck", () => {
            const engine = makeEngine("StructEngine");
            EngineRegistry.getInstance().register(engine);
            const results = EngineRegistry.getInstance().healthCheckAll();
            expect(results).toHaveLength(1);
            expect(results[0].name).toBe("StructEngine");
            expect(typeof results[0].healthy).toBe("boolean");
            expect(typeof results[0].lastCheck).toBe("string");
            expect(results[0].lastCheck).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });

        it("marks engine unhealthy when health() returns false", () => {
            const unhealthy = makeEngine("UnhealthyEngine", false);
            EngineRegistry.getInstance().register(unhealthy);
            const results = EngineRegistry.getInstance().healthCheckAll();
            expect(results.some((r) => r.name === "UnhealthyEngine" && !r.healthy)).toBe(true);
        });

        it("marks engine unhealthy when health() throws", () => {
            const throwingEngine: Engine = {
                name: "ThrowingEngine",
                initialize(): void {},
                health(): boolean {
                    throw new Error("Health check failed");
                }
            };
            EngineRegistry.getInstance().register(throwingEngine);
            const results = EngineRegistry.getInstance().healthCheckAll();
            expect(results.some((r) => r.name === "ThrowingEngine" && !r.healthy)).toBe(true);
        });

        it("returns empty array when no engines registered", () => {
            expect(EngineRegistry.getInstance().healthCheckAll()).toHaveLength(0);
        });
    });
});

describe("LifecycleManager Phase 11-1.2", () => {
    const shutdownCalls: string[] = [];

    beforeEach(() => {
        EngineRegistry.resetInstance();
        LifecycleManager.resetInstance();
        shutdownCalls.length = 0;
    });

    function makeTrackedEngine(name: string, healthy: boolean = true): Engine {
        return {
            name,
            initialize(): void {},
            health(): boolean {
                return healthy;
            },
            shutdown(): void {
                shutdownCalls.push(name);
            }
        };
    }

    describe("getStartupOrder", () => {
        it("returns engines in dependency tier order", () => {
            const registry = EngineRegistry.getInstance();
            registry.register(makeTrackedEngine("APIGatewayEngine"));
            registry.register(makeTrackedEngine("MemoryEngine"));
            registry.register(makeTrackedEngine("AutonomousOperationsEngine"));
            registry.register(makeTrackedEngine("KnowledgeEngine"));
            registry.register(makeTrackedEngine("ExecutiveIntelligenceEngine"));

            const order = LifecycleManager.getInstance().getStartupOrder();
            const names = order.map((e) => e.name);

            const memoryIdx = names.indexOf("MemoryEngine");
            const knowledgeIdx = names.indexOf("KnowledgeEngine");
            const autonomousIdx = names.indexOf("AutonomousOperationsEngine");
            const executiveIdx = names.indexOf("ExecutiveIntelligenceEngine");
            const apiIdx = names.indexOf("APIGatewayEngine");

            expect(memoryIdx).toBeGreaterThanOrEqual(0);
            expect(knowledgeIdx).toBeGreaterThanOrEqual(0);
            expect(autonomousIdx).toBeGreaterThanOrEqual(0);
            expect(executiveIdx).toBeGreaterThanOrEqual(0);
            expect(apiIdx).toBeGreaterThanOrEqual(0);

            expect(memoryIdx).toBeLessThan(autonomousIdx);
            expect(knowledgeIdx).toBeLessThan(autonomousIdx);
            expect(autonomousIdx).toBeLessThan(executiveIdx);
            expect(executiveIdx).toBeLessThan(apiIdx);
        });

        it("places base engines before dependent engines", () => {
            const registry = EngineRegistry.getInstance();
            registry.register(makeTrackedEngine("DecisionEngine"));
            registry.register(makeTrackedEngine("MemoryEngine"));
            registry.register(makeTrackedEngine("ProjectPilotEngine"));

            const names = LifecycleManager.getInstance().getStartupOrder().map((e) => e.name);
            expect(names.indexOf("MemoryEngine")).toBeLessThan(names.indexOf("ProjectPilotEngine"));
            expect(names.indexOf("DecisionEngine")).toBeLessThan(names.indexOf("ProjectPilotEngine"));
        });

        it("places composite engines after their dependencies", () => {
            const registry = EngineRegistry.getInstance();
            registry.register(makeTrackedEngine("OrganizationalIntelligenceEngine"));
            registry.register(makeTrackedEngine("MemoryEngine"));
            registry.register(makeTrackedEngine("KnowledgeEngine"));
            registry.register(makeTrackedEngine("ProjectPilotEngine"));

            const names = LifecycleManager.getInstance().getStartupOrder().map((e) => e.name);
            expect(names.indexOf("MemoryEngine")).toBeLessThan(names.indexOf("OrganizationalIntelligenceEngine"));
            expect(names.indexOf("KnowledgeEngine")).toBeLessThan(names.indexOf("OrganizationalIntelligenceEngine"));
            expect(names.indexOf("ProjectPilotEngine")).toBeLessThan(names.indexOf("OrganizationalIntelligenceEngine"));
        });

        it("returns unknown engines at the end", () => {
            const registry = EngineRegistry.getInstance();
            registry.register(makeTrackedEngine("CustomEngine"));

            const names = LifecycleManager.getInstance().getStartupOrder().map((e) => e.name);
            expect(names[names.length - 1]).toBe("CustomEngine");
        });
    });

    describe("getShutdownOrder", () => {
        it("returns reverse of startup order", () => {
            const registry = EngineRegistry.getInstance();
            registry.register(makeTrackedEngine("MemoryEngine"));
            registry.register(makeTrackedEngine("ExecutiveIntelligenceEngine"));
            registry.register(makeTrackedEngine("APIGatewayEngine"));

            const startup = LifecycleManager.getInstance().getStartupOrder().map((e) => e.name);
            const shutdown = LifecycleManager.getInstance().getShutdownOrder().map((e) => e.name);
            expect(shutdown).toEqual([...startup].reverse());
        });
    });

    describe("initializeAll", () => {
        it("starts engines in dependency order", () => {
            const registry = EngineRegistry.getInstance();
            const callOrder: string[] = [];
            registry.register({
                name: "MemoryEngine",
                initialize(): void { callOrder.push("MemoryEngine"); },
                health(): boolean { return true; },
                shutdown(): void { callOrder.push("MemoryEngine"); }
            });
            registry.register({
                name: "ExecutiveIntelligenceEngine",
                initialize(): void { callOrder.push("ExecutiveIntelligenceEngine"); },
                health(): boolean { return true; },
                shutdown(): void { callOrder.push("ExecutiveIntelligenceEngine"); }
            });
            registry.register({
                name: "APIGatewayEngine",
                initialize(): void { callOrder.push("APIGatewayEngine"); },
                health(): boolean { return true; },
                shutdown(): void { callOrder.push("APIGatewayEngine"); }
            });

            return LifecycleManager.getInstance().initializeAll().then(() => {
                const memIdx = callOrder.indexOf("MemoryEngine");
                const execIdx = callOrder.indexOf("ExecutiveIntelligenceEngine");
                const apiIdx = callOrder.indexOf("APIGatewayEngine");
                expect(memIdx).toBeLessThan(execIdx);
                expect(execIdx).toBeLessThan(apiIdx);
            });
        });

        it("resolves when all engines initialized", async () => {
            const registry = EngineRegistry.getInstance();
            registry.register(makeTrackedEngine("FastEngine"));
            await expect(LifecycleManager.getInstance().initializeAll()).resolves.toBeUndefined();
        });
    });

    describe("shutdownAll", () => {
        it("stops engines in reverse dependency order", async () => {
            const registry = EngineRegistry.getInstance();
            registry.register(makeTrackedEngine("MemoryEngine"));
            registry.register(makeTrackedEngine("ExecutiveIntelligenceEngine"));
            registry.register(makeTrackedEngine("APIGatewayEngine"));

            await LifecycleManager.getInstance().initializeAll();
            await LifecycleManager.getInstance().shutdownAll();

            const apiIdx = shutdownCalls.indexOf("APIGatewayEngine");
            const execIdx = shutdownCalls.indexOf("ExecutiveIntelligenceEngine");
            const memIdx = shutdownCalls.indexOf("MemoryEngine");
            expect(apiIdx).toBeLessThan(execIdx);
            expect(execIdx).toBeLessThan(memIdx);
        });

        it("resolves when all engines shutdown", async () => {
            const registry = EngineRegistry.getInstance();
            registry.register(makeTrackedEngine("FastEngine"));
            await LifecycleManager.getInstance().initializeAll();
            await expect(LifecycleManager.getInstance().shutdownAll()).resolves.toBeUndefined();
        });

        it("does not throw on engines without shutdown method", async () => {
            const registry = EngineRegistry.getInstance();
            registry.register({
                name: "NoShutdownEngine",
                initialize(): void {},
                health(): boolean { return true; }
            });
            await LifecycleManager.getInstance().initializeAll();
            await expect(LifecycleManager.getInstance().shutdownAll()).resolves.toBeUndefined();
        });
    });

    describe("11+ canonical engines register and start correctly", () => {
        it("all canonical engines can register and initialize", async () => {
            const registry = EngineRegistry.getInstance();
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

            canonicalNames.forEach((name) => {
                registry.register(makeTrackedEngine(name));
            });

            expect(registry.getAllEngines()).toHaveLength(canonicalNames.length);

            const results = registry.healthCheckAll();
            expect(results).toHaveLength(canonicalNames.length);
            expect(results.every((r) => r.healthy)).toBe(true);

            await LifecycleManager.getInstance().initializeAll();
            await LifecycleManager.getInstance().shutdownAll();
        });
    });

    describe("integration: HealthMonitorEngine uses EngineRegistry", () => {
        it("HealthMonitorEngine.registerEngine delegates to EngineRegistry", () => {
            const { HealthMonitorEngine } = require("../Engines/HealthMonitorEngine");
            const monitor = new HealthMonitorEngine();
            monitor.initialize();

            const engine = makeEngine("IntegratedEngine");
            monitor.registerEngine(engine);

            expect(EngineRegistry.getInstance().getEngine("IntegratedEngine")).toBe(engine);
        });

        it("HealthMonitorEngine.getEngine reads from EngineRegistry", () => {
            const { HealthMonitorEngine } = require("../Engines/HealthMonitorEngine");
            const monitor = new HealthMonitorEngine();
            monitor.initialize();

            const engine = makeEngine("RegistryReadEngine");
            EngineRegistry.getInstance().register(engine);

            expect(monitor.getEngine("RegistryReadEngine")).toBe(engine);
        });

        it("HealthMonitorEngine.unregisterEngine delegates to EngineRegistry", () => {
            const { HealthMonitorEngine } = require("../Engines/HealthMonitorEngine");
            const monitor = new HealthMonitorEngine();
            monitor.initialize();

            const engine = makeEngine("ToRemoveEngine");
            monitor.registerEngine(engine);
            monitor.unregisterEngine("ToRemoveEngine");

            expect(EngineRegistry.getInstance().getEngine("ToRemoveEngine")).toBeUndefined();
        });
    });
});
