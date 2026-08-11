import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CanonicalCapabilityAudit } from "../Autonomous/Runtime/CanonicalCapabilityAudit";
import { AutonomousProjectMission } from "../Autonomous/Runtime/AutonomousProjectMission";

function write(root: string, relative: string, content = "ok"): void {
    const path = join(root, relative);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, content, "utf8");
}

function seedRoadmap(root: string): void {
    write(root, "Docs/ROADMAP.md", [
        "# HooshyarOS Roadmap",
        "## Phase 2",
        "User Management",
        "Organization Model",
        "Security Layer",
        "API Gateway",
        "## Phase 3",
        "Financial Analysis",
        "Budget Intelligence",
        "Tax Intelligence",
        "Risk Intelligence",
        "## Phase 4",
        "Dashboard",
        "Reports",
        "Alerts",
        "AI Assistant",
        "## Phase 5",
        "Cloud Deployment",
        "Security Audit",
        "Performance Testing",
        "Customer Testing"
    ].join("\n"));
}

describe("CanonicalCapabilityAudit", () => {
    it("accepts an exhausted roadmap when every repository artifact exists", () => {
        const root = mkdtempSync(join(process.cwd(), "tmp-canonical-audit-"));
        try {
            seedRoadmap(root);
            const artifacts = [
                "Backend/HBOS/Engines/UserManagementEngine.ts",
                "Backend/HBOS/test/UserManagementEngine.test.ts",
                "Docs/Engines/UserManagementEngine.md",
                "Backend/HBOS/Engines/OrganizationModelEngine.ts",
                "Backend/HBOS/test/OrganizationModelEngine.test.ts",
                "Docs/Engines/OrganizationModelEngine.md",
                "Backend/HBOS/Engines/SecurityLayerEngine.ts",
                "Backend/HBOS/test/SecurityLayerEngine.test.ts",
                "Docs/Engines/SecurityLayerEngine.md",
                "Backend/HBOS/Engines/APIGatewayEngine.ts",
                "Backend/HBOS/test/APIGatewayEngine.test.ts",
                "Docs/Engines/APIGatewayEngine.md",
                "Backend/HBOS/Engines/FinancialIntelligenceEngine.ts",
                "Backend/HBOS/test/FinancialIntelligenceEngine.test.ts",
                "Docs/Engines/FinancialIntelligenceEngine.md",
                "Backend/HBOS/Engines/BudgetIntelligenceEngine.ts",
                "Backend/HBOS/test/BudgetIntelligenceEngine.test.ts",
                "Docs/Engines/BudgetIntelligenceEngine.md",
                "Backend/HBOS/Engines/TaxIntelligenceEngine.ts",
                "Backend/HBOS/test/TaxIntelligenceEngine.test.ts",
                "Docs/Engines/TaxIntelligenceEngine.md",
                "Backend/HBOS/Engines/RiskIntelligenceEngine.ts",
                "Backend/HBOS/test/RiskIntelligenceEngine.test.ts",
                "Backend/HBOS/Engines/DashboardEngine.ts",
                "Backend/HBOS/test/DashboardEngine.test.ts",
                "Docs/Engines/DashboardEngine.md",
                "Backend/HBOS/Engines/ReportsEngine.ts",
                "Backend/HBOS/test/ReportsEngine.test.ts",
                "Docs/Engines/ReportsEngine.md",
                "Backend/HBOS/Engines/AlertsEngine.ts",
                "Backend/HBOS/test/AlertsEngine.test.ts",
                "Docs/Engines/AlertsEngine.md",
                "Backend/HBOS/Assistant/Autonomous/HooshyarAutonomousAssistant.ts",
                "Backend/HBOS/test/HooshyarAutonomousAssistant.test.ts"
            ];
            artifacts.forEach(file => write(root, file));
            const mission = { nextPlatformMission: () => null } as unknown as AutonomousProjectMission;
            const result = new CanonicalCapabilityAudit().audit(root, mission);
            expect(result.complete).toBe(true);
            expect(result.backlogExhausted).toBe(true);
            expect(result.missingArtifacts).toEqual([]);
            expect(result.nonAutonomousProductionItems).toEqual([
                "Cloud Deployment",
                "Security Audit",
                "Performance Testing",
                "Customer Testing"
            ]);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("rejects completion when a roadmap capability artifact is missing", () => {
        const root = mkdtempSync(join(process.cwd(), "tmp-canonical-audit-missing-"));
        try {
            seedRoadmap(root);
            write(root, "Backend/HBOS/Engines/UserManagementEngine.ts");
            const mission = { nextPlatformMission: () => null } as unknown as AutonomousProjectMission;
            const result = new CanonicalCapabilityAudit().audit(root, mission);
            expect(result.complete).toBe(false);
            expect(result.missingArtifacts.length).toBeGreaterThan(0);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
