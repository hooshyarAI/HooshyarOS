import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CommercialArtifactQualityAudit } from "./CommercialArtifactQualityAudit";

export interface CommercialProductCompletionAuditResult {
    complete: boolean;
    contractPresent: boolean;
    missingLayers: string[];
    blockedExternalDependencies: string[];
}

interface RoadmapCapability {
    capabilityId?: string;
    implementationPath?: string;
    testPath?: string;
    documentationPath?: string;
}

export class CommercialProductCompletionAudit {
    private readonly contractPath = "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md";
    private readonly roadmapPath = "Docs/Product/PRODUCT_CONSTRUCTION_ROADMAP.json";
    private readonly qualityAudit = new CommercialArtifactQualityAudit();

    audit(root: string): CommercialProductCompletionAuditResult {
        const contractFile = join(root, this.contractPath);
        if (!existsSync(contractFile)) {
            return { complete: false, contractPresent: false, missingLayers: ["commercial-completion-contract"], blockedExternalDependencies: [] };
        }

        const contract = readFileSync(contractFile, "utf8");
        const requiredMarkers = [
            "## Commercial completion layers",
            "1. Product runtime",
            "2. Identity, users and organizations",
            "4. Data ingestion and canonical data",
            "9. Dashboards and reports",
            "14. Deployment and installation",
            "## Evidence model",
            "## Completion states"
        ];
        const missingLayers = requiredMarkers.filter(marker => !contract.includes(marker)).map(marker => `contract-marker:${marker}`);

        const requiredArtifacts: Array<[string, string]> = [
            ["api-gateway", "Backend/HBOS/Engines/APIGatewayEngine.ts"],
            ["user-management", "Backend/HBOS/Engines/UserManagementEngine.ts"],
            ["organization-model", "Backend/HBOS/Engines/OrganizationModelEngine.ts"],
            ["dashboard-engine", "Backend/HBOS/Engines/DashboardEngine.ts"],
            ["reports-engine", "Backend/HBOS/Engines/ReportsEngine.ts"],
            ["deployment-contract", "Backend/HBOS/Engines/DeploymentContractEngine.ts"]
        ];
        for (const [layer, artifact] of requiredArtifacts) {
            if (!existsSync(join(root, artifact))) missingLayers.push(layer);
        }

        const packagePath = join(root, "package.json");
        if (!existsSync(packagePath)) {
            missingLayers.push("web-entrypoint");
        } else {
            const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as { scripts?: Record<string, string> };
            const scripts = packageJson.scripts ?? {};
            const hasRunnableWebScript = Boolean(scripts.start || scripts.dev || scripts.serve || scripts.preview);
            const hasWebSource = ["frontend", "web", "app", "src/app", "Frontend/HooshyarWebApp"].some(dir => existsSync(join(root, dir)));
            if (!hasRunnableWebScript && !hasWebSource) missingLayers.push("web-entrypoint");
        }

        const persistenceCandidates = [
            "Backend/HBOS/Infrastructure",
            "Backend/HBOS/Persistence",
            "Backend/AI_Runtime/persistence",
            "prisma",
            "database",
            "Backend/HBOS/Product/TenantPersistenceService.ts"
        ];
        if (!persistenceCandidates.some(candidate => existsSync(join(root, candidate)))) missingLayers.push("persistence-boundary");

        const authCandidates = [
            "Backend/HBOS/Auth",
            "Backend/HBOS/Security",
            "Backend/HBOS/Identity",
            "Backend/HBOS/Product/OrganizationIdentityService.ts"
        ];
        if (!authCandidates.some(candidate => existsSync(join(root, candidate)))) missingLayers.push("authentication-authorization-boundary");

        if (existsSync(join(root, this.roadmapPath))) {
            try {
                const roadmap = JSON.parse(readFileSync(join(root, this.roadmapPath), "utf8")) as { capabilities?: RoadmapCapability[] };
                for (const capability of roadmap.capabilities ?? []) {
                    const paths = [capability.implementationPath, capability.testPath, capability.documentationPath]
                        .filter((value): value is string => typeof value === "string" && value.length > 0);
                    const missing = paths.filter(path => !existsSync(join(root, path)));
                    if (missing.length > 0) {
                        missingLayers.push(`roadmap:${capability.capabilityId ?? "unknown"}:${missing.join(",")}`);
                    }
                }
            } catch {
                missingLayers.push("commercial-roadmap-invalid");
            }
        } else {
            missingLayers.push("commercial-roadmap-missing");
        }

        const quality = this.qualityAudit.audit(root);
        for (const failure of quality.failures) missingLayers.push(`quality:${failure}`);

        const blockedExternalDependencies: string[] = [];
        if (contract.includes("Payment-provider activation is an external dependency")) blockedExternalDependencies.push("payment-provider-activation");
        if (contract.includes("Cloud deployment may remain externally blocked")) blockedExternalDependencies.push("production-cloud-resources");

        return { complete: missingLayers.length === 0 && quality.complete, contractPresent: true, missingLayers, blockedExternalDependencies };
    }
}
