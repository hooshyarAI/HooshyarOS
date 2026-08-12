import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AutonomousProjectMission } from "../Autonomous/Runtime/AutonomousProjectMission";

describe("AutonomousPlatformWeaving", () => {
    const createProject = () => {
        const root = join(tmpdir(), `hooshyar-weaving-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        mkdirSync(root, { recursive: true });
        return root;
    };

    const behaviorByEngine: Record<string, string> = {
        UserManagementEngine: "registerUser(",
        OrganizationModelEngine: "createOrganization(",
        SecurityLayerEngine: "authorize(",
        APIGatewayEngine: "route(",
        ReasoningEngine: "reason(",
        OrganizationalIntelligenceEngine: "assess(",
        AutonomousOperationsEngine: "execute(",
        FinancialIntelligenceEngine: "analyze(",
        BudgetIntelligenceEngine: "analyzeBudget(",
        TaxIntelligenceEngine: "estimate(",
        RiskIntelligenceEngine: "assess(",
        DashboardEngine: "snapshot(",
        ReportsEngine: "build(",
        AlertsEngine: "evaluate(",
        ProductionReadinessEngine: "audit(",
        SecurityAuditEngine: "audit(",
        PerformanceTestingEngine: "run(",
        CustomerTestingEngine: "run(",
        DeploymentReadinessEngine: "assess(",
        DeploymentContractEngine: "validate(",
        CloudDeploymentEngine: "deploy("
    };

    const artifact = (root: string, path: string) => {
        const target = join(root, path);
        mkdirSync(join(target, ".."), { recursive: true });
        const match = path.match(/(?:Engines|test)[\\/]([^\\/]+)Engine(?:\.test)?\.ts$/);
        const className = match?.[1] ? `${match[1]}Engine` : "";
        const behavior = behaviorByEngine[className] ?? "verified";
        const isTest = /[\\/]test[\\/]/.test(path);
        writeFileSync(target, isTest ? `describe("behavior", () => { test("works", () => { ${behavior} expect(true).toBe(true); }); });\n` : `${behavior} // verified implementation evidence\n`, "utf8");
    };

    const complete = (root: string, paths: string[]) => paths.forEach(path => artifact(root, path));

    it("weaves the entire canonical backlog one knot at a time", () => {
        const root = createProject();
        const mission = new AutonomousProjectMission(root);

        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.user-management");

        complete(root, [
            "Backend/HBOS/Engines/UserManagementEngine.ts",
            "Backend/HBOS/test/UserManagementEngine.test.ts",
            "Docs/Engines/UserManagementEngine.md"
        ]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.organization-model");

        complete(root, ["Backend/HBOS/Engines/OrganizationModelEngine.ts", "Backend/HBOS/test/OrganizationModelEngine.test.ts", "Docs/Engines/OrganizationModelEngine.md"]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.security-layer");

        complete(root, ["Backend/HBOS/Engines/SecurityLayerEngine.ts", "Backend/HBOS/test/SecurityLayerEngine.test.ts", "Docs/Engines/SecurityLayerEngine.md"]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.api-gateway");

        complete(root, ["Backend/HBOS/Engines/APIGatewayEngine.ts", "Backend/HBOS/test/APIGatewayEngine.test.ts", "Docs/Engines/APIGatewayEngine.md"]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("engine.reasoning.canonical");

        complete(root, ["Backend/HBOS/Engines/ReasoningEngine.ts", "Backend/HBOS/test/ReasoningEngine.test.ts", "Backend/AI_Runtime/reasoning/reasoning_engine.py"]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("engine.organizational.canonical");

        complete(root, ["Backend/HBOS/Engines/OrganizationalIntelligenceEngine.ts", "Backend/HBOS/test/OrganizationalIntelligenceEngine.test.ts"]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("engine.autonomous-operations.canonical");

        complete(root, ["Backend/HBOS/Engines/AutonomousOperationsEngine.ts", "Backend/HBOS/test/AutonomousOperationsEngine.test.ts"]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("runtime.reasoning.bridge");

        complete(root, ["Backend/HBOS/Engines/ReasoningEngine.ts", "Backend/HBOS/Assistant/Autonomous/PythonReasoningAdapter.ts", "Backend/HBOS/test/PythonReasoningAdapter.test.ts", "Backend/AI_Runtime/reasoning/reasoning_engine.py"]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.financial-intelligence");

        complete(root, ["Backend/HBOS/Engines/FinancialIntelligenceEngine.ts", "Backend/HBOS/test/FinancialIntelligenceEngine.test.ts", "Docs/Engines/FinancialIntelligenceEngine.md"]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.budget-intelligence");

        complete(root, ["Backend/HBOS/Engines/BudgetIntelligenceEngine.ts", "Backend/HBOS/test/BudgetIntelligenceEngine.test.ts", "Docs/Engines/BudgetIntelligenceEngine.md"]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.tax-intelligence");

        complete(root, ["Backend/HBOS/Engines/TaxIntelligenceEngine.ts", "Backend/HBOS/test/TaxIntelligenceEngine.test.ts", "Docs/Engines/TaxIntelligenceEngine.md"]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.dashboard");

        complete(root, ["Backend/HBOS/Engines/DashboardEngine.ts", "Backend/HBOS/test/DashboardEngine.test.ts", "Docs/Engines/DashboardEngine.md"]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.reports");

        complete(root, ["Backend/HBOS/Engines/ReportsEngine.ts", "Backend/HBOS/test/ReportsEngine.test.ts", "Docs/Engines/ReportsEngine.md"]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.alerts");

        complete(root, ["Backend/HBOS/Engines/AlertsEngine.ts", "Backend/HBOS/test/AlertsEngine.test.ts", "Docs/Engines/AlertsEngine.md"]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.production-readiness");

        complete(root, ["Backend/HBOS/Engines/ProductionReadinessEngine.ts", "Backend/HBOS/test/ProductionReadinessEngine.test.ts", "Docs/Engines/ProductionReadinessEngine.md"]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.security-audit");

        complete(root, ["Backend/HBOS/Engines/SecurityAuditEngine.ts", "Backend/HBOS/test/SecurityAuditEngine.test.ts", "Docs/Engines/SecurityAuditEngine.md"]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.performance-testing");

        complete(root, ["Backend/HBOS/Engines/PerformanceTestingEngine.ts", "Backend/HBOS/test/PerformanceTestingEngine.test.ts", "Docs/Engines/PerformanceTestingEngine.md"]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.customer-testing");

        complete(root, ["Backend/HBOS/Engines/CustomerTestingEngine.ts", "Backend/HBOS/test/CustomerTestingEngine.test.ts", "Docs/Engines/CustomerTestingEngine.md"]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.deployment-readiness");

        complete(root, ["Backend/HBOS/Engines/DeploymentReadinessEngine.ts", "Backend/HBOS/test/DeploymentReadinessEngine.test.ts", "Docs/Engines/DeploymentReadinessEngine.md"]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.deployment-contract");

        complete(root, ["Backend/HBOS/Engines/DeploymentContractEngine.ts", "Backend/HBOS/test/DeploymentContractEngine.test.ts", "Docs/Engines/DeploymentContractEngine.md"]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.cloud-deployment");

        complete(root, ["Backend/HBOS/Engines/CloudDeploymentEngine.ts", "Backend/HBOS/test/CloudDeploymentEngine.test.ts", "Docs/Engines/CloudDeploymentEngine.md"]);
        expect(mission.nextPlatformMission()).toBeNull();
    });

    it("does not skip a later capability when an earlier capability is blocked", () => {
        const root = createProject();
        const mission = new AutonomousProjectMission(root);

        complete(root, [
            "Backend/HBOS/Engines/UserManagementEngine.ts", "Backend/HBOS/test/UserManagementEngine.test.ts", "Docs/Engines/UserManagementEngine.md",
            "Backend/HBOS/Engines/OrganizationModelEngine.ts", "Backend/HBOS/test/OrganizationModelEngine.test.ts", "Docs/Engines/OrganizationModelEngine.md",
            "Backend/HBOS/Engines/SecurityLayerEngine.ts", "Backend/HBOS/test/SecurityLayerEngine.test.ts", "Docs/Engines/SecurityLayerEngine.md"
        ]);

        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.api-gateway");
    });
});
