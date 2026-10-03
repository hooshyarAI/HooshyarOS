import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AutonomousProjectMission } from "./AutonomousProjectMission";
import { behavioralEvidenceSatisfied } from "./CapabilityEvidenceAudit";

export interface CanonicalCapabilityAuditResult {
    complete: boolean;
    roadmapPresent: boolean;
    backlogExhausted: boolean;
    missingArtifacts: string[];
    nonAutonomousProductionItems: string[];
    /**
     * Roadmap capabilities whose owning implementation and focused test exist but
     * where real behavioral evidence could not be proven (marker/regex presence is
     * not behavioral evidence). Non-empty => completion must fail closed.
     */
    nonBehavioralCapabilities: string[];
}

export class CanonicalCapabilityAudit {
    private readonly semanticMethods: Record<string, string[]> = {
        "User Management": ["registerUser"],
        "Organization Model": ["createOrganization"],
        "Security Layer": ["authorize"],
        "API Gateway": ["route"],
        "Financial Analysis": ["analyze"],
        "Budget Intelligence": ["analyze"],
        "Tax Intelligence": ["estimate"],
        "Risk Intelligence": ["assess"],
        "Dashboard": ["snapshot"],
        "Reports": ["build"],
        "Alerts": ["evaluate"]
    };

    audit(root: string, mission: AutonomousProjectMission): CanonicalCapabilityAuditResult {
        const roadmapPath = join(root, "Docs", "ROADMAP.md");
        const roadmapPresent = existsSync(roadmapPath);
        if (!roadmapPresent) {
            return {
                complete: false,
                roadmapPresent: false,
                backlogExhausted: false,
                missingArtifacts: ["Docs/ROADMAP.md"],
                nonAutonomousProductionItems: [],
                nonBehavioralCapabilities: []
            };
        }

        const roadmap = readFileSync(roadmapPath, "utf8");
        const capabilityArtifacts: string[][] = [
            ["User Management", "Backend/HBOS/Engines/UserManagementEngine.ts", "Backend/HBOS/test/UserManagementEngine.test.ts", "Docs/Engines/UserManagementEngine.md"],
            ["Organization Model", "Backend/HBOS/Engines/OrganizationModelEngine.ts", "Backend/HBOS/test/OrganizationModelEngine.test.ts", "Docs/Engines/OrganizationModelEngine.md"],
            ["Security Layer", "Backend/HBOS/Engines/SecurityLayerEngine.ts", "Backend/HBOS/test/SecurityLayerEngine.test.ts", "Docs/Engines/SecurityLayerEngine.md"],
            ["API Gateway", "Backend/HBOS/Engines/APIGatewayEngine.ts", "Backend/HBOS/test/APIGatewayEngine.test.ts", "Docs/Engines/APIGatewayEngine.md"],
            ["Financial Analysis", "Backend/HBOS/Engines/FinancialIntelligenceEngine.ts", "Backend/HBOS/test/FinancialIntelligenceEngine.test.ts", "Docs/Engines/FinancialIntelligenceEngine.md"],
            ["Budget Intelligence", "Backend/HBOS/Engines/BudgetIntelligenceEngine.ts", "Backend/HBOS/test/BudgetIntelligenceEngine.test.ts", "Docs/Engines/BudgetIntelligenceEngine.md"],
            ["Tax Intelligence", "Backend/HBOS/Engines/TaxIntelligenceEngine.ts", "Backend/HBOS/test/TaxIntelligenceEngine.test.ts", "Docs/Engines/TaxIntelligenceEngine.md"],
            ["Risk Intelligence", "Backend/HBOS/Engines/RiskIntelligenceEngine.ts", "Backend/HBOS/test/RiskIntelligenceEngine.test.ts"],
            ["Dashboard", "Backend/HBOS/Engines/DashboardEngine.ts", "Backend/HBOS/test/DashboardEngine.test.ts", "Docs/Engines/DashboardEngine.md"],
            ["Reports", "Backend/HBOS/Engines/ReportsEngine.ts", "Backend/HBOS/test/ReportsEngine.test.ts", "Docs/Engines/ReportsEngine.md"],
            ["Alerts", "Backend/HBOS/Engines/AlertsEngine.ts", "Backend/HBOS/test/AlertsEngine.test.ts", "Docs/Engines/AlertsEngine.md"],
            ["AI Assistant", "Backend/HBOS/Assistant/Autonomous/HooshyarAutonomousAssistant.ts", "Backend/HBOS/test/HooshyarAutonomousAssistant.test.ts"],
            ["Repository Production Readiness", "Backend/HBOS/Engines/ProductionReadinessEngine.ts", "Backend/HBOS/test/ProductionReadinessEngine.test.ts", "Docs/Engines/ProductionReadinessEngine.md"],
            ["Security Audit", "Backend/HBOS/Engines/SecurityAuditEngine.ts", "Backend/HBOS/test/SecurityAuditEngine.test.ts", "Docs/Engines/SecurityAuditEngine.md"],
            ["Performance Testing", "Backend/HBOS/Engines/PerformanceTestingEngine.ts", "Backend/HBOS/test/PerformanceTestingEngine.test.ts", "Docs/Engines/PerformanceTestingEngine.md"],
            ["Customer Testing", "Backend/HBOS/Engines/CustomerTestingEngine.ts", "Backend/HBOS/test/CustomerTestingEngine.test.ts", "Docs/Engines/CustomerTestingEngine.md"],
            ["Deployment Readiness", "Backend/HBOS/Engines/DeploymentReadinessEngine.ts", "Backend/HBOS/test/DeploymentReadinessEngine.test.ts", "Docs/Engines/DeploymentReadinessEngine.md"],
            ["Deployment Contract", "Backend/HBOS/Engines/DeploymentContractEngine.ts", "Backend/HBOS/test/DeploymentContractEngine.test.ts", "Docs/Engines/DeploymentContractEngine.md"],
            ["Cloud Deployment", "Backend/HBOS/Engines/CloudDeploymentEngine.ts", "Backend/HBOS/test/CloudDeploymentEngine.test.ts", "Docs/Engines/CloudDeploymentEngine.md", "Backend/HBOS/Assistant/Autonomous/Production/DeploymentController.ts", "Backend/AI_Runtime/cloud_deployment.py"]
        ];

        const missingArtifacts: string[] = [];
        const nonBehavioralCapabilities: string[] = [];
        for (const [label, ...artifacts] of capabilityArtifacts) {
            if (!roadmap.includes(label)) continue;
            for (const artifact of artifacts) {
                if (!existsSync(join(root, artifact))) missingArtifacts.push(`${label}: ${artifact}`);
            }

            const methods = this.semanticMethods[label];
            if (methods && artifacts[0]) {
                const sourcePath = join(root, artifacts[0]);
                if (existsSync(sourcePath)) {
                    const source = readFileSync(sourcePath, "utf8");
                    for (const method of methods) {
                        if (!new RegExp(`\\b${method}\\s*\\(`).test(source)) {
                            missingArtifacts.push(`${label}: semantic behavior '${method}'`);
                        }
                    }
                }
            }

            // File existence and marker/regex presence are NOT behavioral completion.
            // A roadmap capability is only behaviorally evidenced when its owning
            // implementation and focused test exist and the focused test actually
            // exercises a behavior the implementation defines.
            const implementationPath = artifacts[0];
            const testPath = artifacts[1];
            if (!implementationPath || !testPath) {
                nonBehavioralCapabilities.push(label);
                continue;
            }
            const implementationFile = join(root, implementationPath);
            const testFile = join(root, testPath);
            if (!existsSync(implementationFile) || !existsSync(testFile)) {
                nonBehavioralCapabilities.push(label);
                continue;
            }
            const implementationSource = readFileSync(implementationFile, "utf8");
            const testSource = readFileSync(testFile, "utf8");
            if (!behavioralEvidenceSatisfied(implementationSource, testSource, methods ?? [])) {
                nonBehavioralCapabilities.push(label);
            }
        }

        const backlogExhausted = mission.nextPlatformMission() === null;
        const cloudArtifacts = capabilityArtifacts.find(entry => entry[0] === "Cloud Deployment")?.slice(1) ?? [];
        const cloudComplete = cloudArtifacts.every(artifact => existsSync(join(root, artifact)));
        const nonAutonomousProductionItems = ["Cloud Deployment"].filter(item => roadmap.includes(item) && !cloudComplete);

        return {
            complete: roadmapPresent && backlogExhausted && missingArtifacts.length === 0 && nonBehavioralCapabilities.length === 0,
            roadmapPresent,
            backlogExhausted,
            missingArtifacts,
            nonAutonomousProductionItems,
            nonBehavioralCapabilities
        };
    }
}
