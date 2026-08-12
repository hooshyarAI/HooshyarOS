import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { AutonomousPlatformContinuation } from "../Autonomous/Runtime/AutonomousPlatformContinuation";
import { AutonomousProjectMission } from "../Autonomous/Runtime/AutonomousProjectMission";

function seedFiles(root: string, files: string[]): void {
    files.forEach(file => {
        const path = join(root, file);
        mkdirSync(join(path, ".."), { recursive: true });
        require("node:fs").writeFileSync(path, "ok", "utf8");
    });
}

const performanceFiles = ["Backend/HBOS/Engines/PerformanceTestingEngine.ts","Backend/HBOS/test/PerformanceTestingEngine.test.ts","Docs/Engines/PerformanceTestingEngine.md"];
const customerFiles = ["Backend/HBOS/Engines/CustomerTestingEngine.ts","Backend/HBOS/test/CustomerTestingEngine.test.ts","Docs/Engines/CustomerTestingEngine.md"];
const deploymentReadinessFiles = ["Backend/HBOS/Engines/DeploymentReadinessEngine.ts","Backend/HBOS/test/DeploymentReadinessEngine.test.ts","Docs/Engines/DeploymentReadinessEngine.md"];
const deploymentContractFiles = ["Backend/HBOS/Engines/DeploymentContractEngine.ts","Backend/HBOS/test/DeploymentContractEngine.test.ts","Docs/Engines/DeploymentContractEngine.md"];
const cloudFiles = ["Backend/HBOS/Engines/CloudDeploymentEngine.ts","Backend/HBOS/test/CloudDeploymentEngine.test.ts","Docs/Engines/CloudDeploymentEngine.md","Backend/HBOS/Assistant/Autonomous/Production/DeploymentController.ts","Backend/AI_Runtime/cloud_deployment.py"];
const productionAcceptanceFiles = ["Backend/HBOS/Engines/ProductionAcceptanceEngine.ts","Backend/HBOS/test/ProductionAcceptanceEngine.test.ts","Docs/Engines/ProductionAcceptanceEngine.md"];

function writeRoadmap(root: string, capability: Record<string, unknown>): void {
    const path = join(root, "Docs", "Product", "PRODUCT_CONSTRUCTION_ROADMAP.json");
    mkdirSync(join(path, ".."), { recursive: true });
    require("node:fs").writeFileSync(path, JSON.stringify({ version: "2.1", capabilities: [capability] }), "utf8");
}

describe("AutonomousPlatformContinuation", () => {
    it("creates the canonical post-Assistant platform continuation mission", () => {
        const mission = new AutonomousPlatformContinuation().createMission();
        expect(mission.capabilityId).toBe("platform.continuation");
        expect(mission.source).toBe("assistant.completion.gate");
        expect(mission.instruction).toContain("AUDIT");
        expect(mission.instruction).toContain("DISCOVER");
        expect(mission.instruction).toContain("IMPLEMENT");
        expect(mission.instruction).toContain("VERIFY");
        expect(mission.instruction).toContain("PUSH");
    });

    it("delegates continuation selection to the canonical platform backlog", () => {
        const projectMission = new AutonomousProjectMission(process.cwd());
        const selected = new AutonomousPlatformContinuation().selectNextCapability(projectMission);
        expect(selected === null || selected.capabilityId).toBeTruthy();
        expect(selected?.capabilityId).not.toBe("platform.continuation");
    });

    it("selects cloud deployment after the deployment contract is complete", () => {
        const root = mkdtempSync(join(process.cwd(), "tmp-cloud-continuation-"));
        try {
            seedFiles(root, [...performanceFiles, ...customerFiles, ...deploymentReadinessFiles, ...deploymentContractFiles]);
            const projectMission = { nextPlatformMission: () => null, snapshot: () => ({ root }) } as unknown as AutonomousProjectMission;
            const selected = new AutonomousPlatformContinuation().selectNextCapability(projectMission);
            expect(selected?.capabilityId).toBe("platform.cloud-deployment");
            expect(selected?.targetEngine).toBe("Cloud Deployment Engine");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("selects production acceptance after cloud deployment is complete", () => {
        const root = mkdtempSync(join(process.cwd(), "tmp-production-acceptance-"));
        try {
            seedFiles(root, [...performanceFiles, ...customerFiles, ...deploymentReadinessFiles, ...deploymentContractFiles, ...cloudFiles]);
            const projectMission = { nextPlatformMission: () => null, snapshot: () => ({ root }) } as unknown as AutonomousProjectMission;
            const selected = new AutonomousPlatformContinuation().selectNextCapability(projectMission);
            expect(selected?.capabilityId).toBe("platform.production-acceptance");
            expect(selected?.targetEngine).toBe("Production Acceptance Engine");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("selects the first missing commercial roadmap capability after platform extensions are exhausted", () => {
        const root = mkdtempSync(join(process.cwd(), "tmp-commercial-roadmap-"));
        try {
            seedFiles(root, [...performanceFiles, ...customerFiles, ...deploymentReadinessFiles, ...deploymentContractFiles, ...cloudFiles, ...productionAcceptanceFiles]);
            writeRoadmap(root, {
                capabilityId: "product.web-application-shell",
                capability: "provide runnable responsive web/PWA application shell",
                targetEngine: "Assistant Engine",
                dependencies: ["API Gateway", "User Management", "Security Layer"],
                implementationPath: "Frontend/HooshyarWebApp",
                testPath: "Backend/HBOS/test/HooshyarWebApplication.test.ts",
                documentationPath: "Docs/Product/HooshyarWebApplication.md"
            });
            const projectMission = { nextPlatformMission: () => null, snapshot: () => ({ root }) } as unknown as AutonomousProjectMission;
            const selected = new AutonomousPlatformContinuation().selectNextCapability(projectMission);
            expect(selected?.capabilityId).toBe("product.web-application-shell");
            expect(selected?.targetEngine).toBe("Assistant Engine");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("skips completed commercial roadmap capabilities and selects the next missing one", () => {
        const root = mkdtempSync(join(process.cwd(), "tmp-commercial-roadmap-2-"));
        try {
            seedFiles(root, [...performanceFiles, ...customerFiles, ...deploymentReadinessFiles, ...deploymentContractFiles, ...cloudFiles, ...productionAcceptanceFiles,
                "Frontend/HooshyarWebApp", "Backend/HBOS/test/HooshyarWebApplication.test.ts", "Docs/Product/HooshyarWebApplication.md"]);
            writeRoadmap(root, {
                capabilityId: "product.web-application-shell",
                capability: "web shell",
                targetEngine: "Assistant Engine",
                dependencies: [],
                implementationPath: "Frontend/HooshyarWebApp",
                testPath: "Backend/HBOS/test/HooshyarWebApplication.test.ts",
                documentationPath: "Docs/Product/HooshyarWebApplication.md"
            });
            require("node:fs").writeFileSync(join(root, "Docs", "Product", "PRODUCT_CONSTRUCTION_ROADMAP.json"), JSON.stringify({
                version: "2.1",
                capabilities: [
                    {
                        capabilityId: "product.web-application-shell",
                        capability: "web shell",
                        targetEngine: "Assistant Engine",
                        dependencies: [],
                        implementationPath: "Frontend/HooshyarWebApp",
                        testPath: "Backend/HBOS/test/HooshyarWebApplication.test.ts",
                        documentationPath: "Docs/Product/HooshyarWebApplication.md"
                    },
                    {
                        capabilityId: "product.dashboard-and-report-application",
                        capability: "dashboard and reports",
                        targetEngine: "Executive Intelligence Engine",
                        dependencies: ["Dashboard Engine", "Reports Engine"],
                        implementationPath: "Backend/HBOS/Product/CommercialDashboardApplication.ts",
                        testPath: "Backend/HBOS/test/CommercialDashboardApplication.test.ts",
                        documentationPath: "Docs/Product/CommercialDashboardApplication.md"
                    }
                ]
            }), "utf8");
            const projectMission = { nextPlatformMission: () => null, snapshot: () => ({ root }) } as unknown as AutonomousProjectMission;
            const selected = new AutonomousPlatformContinuation().selectNextCapability(projectMission);
            expect(selected?.capabilityId).toBe("product.dashboard-and-report-application");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("returns null when the production extension and commercial roadmap chains are exhausted", () => {
        const root = mkdtempSync(join(process.cwd(), "tmp-production-complete-"));
        try {
            seedFiles(root, [...performanceFiles, ...customerFiles, ...deploymentReadinessFiles, ...deploymentContractFiles, ...cloudFiles, ...productionAcceptanceFiles]);
            writeRoadmap(root, { capabilities: [] } as unknown as Record<string, unknown>);
            expect(new AutonomousPlatformContinuation().selectNextCapability({ nextPlatformMission: () => null, snapshot: () => ({ root }) } as unknown as AutonomousProjectMission)).toBeNull();
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});