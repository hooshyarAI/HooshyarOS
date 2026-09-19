import { Engine } from "../Core/Engine";
import { EngineRegistry } from "./EngineRegistry";

export class LifecycleManager {
    private static instance: LifecycleManager | null = null;

    private readonly tiers: string[][] = [
        ["MemoryEngine", "KnowledgeEngine", "ReactionEngine"],
        [
            "DecisionEngine",
            "IntelligenceEngine",
            "ProjectPilotEngine",
            "SecurityLayerEngine",
            "GovernanceEngine",
            "AssistantEngine",
            "ReasoningEngine",
            "DecisionIntelligenceEngine",
            "UserManagementEngine",
            "OrganizationModelEngine"
        ],
        ["OrganizationalIntelligenceEngine", "AutonomousOperationsEngine"],
        [
            "ExecutiveIntelligenceEngine",
            "FinancialIntelligenceEngine",
            "RiskIntelligenceEngine",
            "BudgetIntelligenceEngine",
            "TaxIntelligenceEngine"
        ],
        [
            "APIGatewayEngine",
            "CloudDeploymentEngine",
            "DeploymentReadinessEngine",
            "DeploymentContractEngine",
            "ProductionReadinessEngine",
            "PerformanceTestingEngine",
            "CustomerTestingEngine",
            "SecurityAuditEngine",
            "ReportsEngine",
            "DashboardEngine",
            "AlertsEngine",
            "ProductionAcceptanceEngine"
        ]
    ];

    private constructor() {}

    static getInstance(): LifecycleManager {
        if (!LifecycleManager.instance) {
            LifecycleManager.instance = new LifecycleManager();
        }
        return LifecycleManager.instance;
    }

    static resetInstance(): void {
        LifecycleManager.instance = new LifecycleManager();
    }

    getStartupOrder(): Engine[] {
        const registry = EngineRegistry.getInstance();
        const all = registry.getAllEngines();
        const ordered: Engine[] = [];
        const seen = new Set<string>();

        for (const tier of this.tiers) {
            for (const name of tier) {
                const engine = registry.getEngine(name);
                if (engine && !seen.has(name)) {
                    ordered.push(engine);
                    seen.add(name);
                }
            }
        }

        for (const engine of all) {
            if (!seen.has(engine.name)) {
                ordered.push(engine);
                seen.add(engine.name);
            }
        }

        return ordered;
    }

    getShutdownOrder(): Engine[] {
        return this.getStartupOrder().reverse();
    }

    async initializeAll(): Promise<void> {
        const engines = this.getStartupOrder();
        for (const engine of engines) {
            engine.initialize();
        }
    }

    async shutdownAll(): Promise<void> {
        const engines = this.getShutdownOrder();
        for (const engine of engines) {
            if (typeof engine.shutdown === "function") {
                await engine.shutdown();
            }
        }
    }
}
