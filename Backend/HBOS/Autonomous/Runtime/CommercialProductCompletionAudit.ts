import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface CommercialProductCompletionAuditResult {
    complete: boolean;
    contractPresent: boolean;
    missingLayers: string[];
    blockedExternalDependencies: string[];
}

export class CommercialProductCompletionAudit {
    private readonly contractPath = "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md";

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
            const hasWebSource = ["frontend", "web", "app", "src/app"].some(dir => existsSync(join(root, dir)));
            if (!hasRunnableWebScript && !hasWebSource) missingLayers.push("web-entrypoint");
        }

        const persistenceCandidates = ["Backend/HBOS/Infrastructure", "Backend/HBOS/Persistence", "Backend/AI_Runtime/persistence", "prisma", "database"];
        if (!persistenceCandidates.some(dir => existsSync(join(root, dir)))) missingLayers.push("persistence-boundary");

        const authCandidates = ["Backend/HBOS/Auth", "Backend/HBOS/Security", "Backend/HBOS/Identity"];
        if (!authCandidates.some(dir => existsSync(join(root, dir)))) missingLayers.push("authentication-authorization-boundary");

        const blockedExternalDependencies: string[] = [];
        if (contract.includes("Payment-provider activation is an external dependency")) blockedExternalDependencies.push("payment-provider-activation");
        if (contract.includes("Cloud deployment may remain externally blocked")) blockedExternalDependencies.push("production-cloud-resources");

        return {
            complete: missingLayers.length === 0 && blockedExternalDependencies.length === 0,
            contractPresent: true,
            missingLayers,
            blockedExternalDependencies
        };
    }
}
