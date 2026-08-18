import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface CommercialProductCompletionAuditResult {
    complete: boolean;
    contractPresent: boolean;
    missingLayers: string[];
    blockedExternalDependencies: string[];
}

interface CommercialRealityEvidence {
    schemaVersion?: number;
    status?: string;
    commit?: string;
    commands?: Array<{ name?: string; exitCode?: number }>;
    artifacts?: {
        installer?: { path?: string; sha256?: string; sizeBytes?: number };
    };
    runtime?: {
        installed?: boolean;
        launched?: boolean;
        health?: boolean;
        dashboard?: boolean;
        shellExitKeepsRuntime?: boolean;
        uninstall?: boolean;
    };
    application?: {
        api?: boolean;
        ui?: boolean;
        representativeData?: boolean;
    };
    persistence?: {
        write?: boolean;
        restartReadback?: boolean;
    };
    security?: {
        authentication?: boolean;
        authorization?: boolean;
        tenantIsolation?: boolean;
        audit?: boolean;
    };
    acceptance?: {
        userValuePath?: boolean;
    };
    externalDependencies?: Array<{
        name?: string;
        required?: boolean;
        status?: "VERIFIED" | "BLOCKED";
    }>;
}

/**
 * Fail-closed commercial product gate.
 *
 * Source artifacts and unit/integration tests establish implementation
 * confidence; they do not establish that the packaged product actually ran.
 * `complete=true` therefore requires a machine-generated, commit-bound
 * commercial reality evidence manifest in addition to the repository-native
 * commercial layers.
 */
export class CommercialProductCompletionAudit {
    private readonly contractPath = "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md";
    private readonly realityEvidencePath = "Docs/Evidence/commercial-product-reality.json";

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
            const webArtifacts = [
                "web/index.html",
                "web/app.js",
                "web/styles.css",
                "web/manifest.webmanifest",
                "Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts"
            ];
            const hasWebRuntime = webArtifacts.every(artifact => existsSync(join(root, artifact)));
            if (!hasRunnableWebScript && !hasWebRuntime) missingLayers.push("web-entrypoint");
        }

        const persistenceCandidates = ["Backend/HBOS/Infrastructure", "Backend/HBOS/Persistence", "Backend/AI_Runtime/persistence", "prisma", "database"];
        if (!persistenceCandidates.some(dir => existsSync(join(root, dir)))) missingLayers.push("persistence-boundary");

        const authCandidates = ["Backend/HBOS/Auth", "Backend/HBOS/Security", "Backend/HBOS/Identity"];
        if (!authCandidates.some(dir => existsSync(join(root, dir)))) missingLayers.push("authentication-authorization-boundary");

        const blockedExternalDependencies: string[] = [];
        if (contract.includes("Payment-provider activation is an external dependency")) blockedExternalDependencies.push("payment-provider-activation");
        if (contract.includes("Cloud deployment may remain externally blocked")) blockedExternalDependencies.push("production-cloud-resources");

        const reality = this.readRealityEvidence(root, missingLayers, blockedExternalDependencies);
        return {
            complete: missingLayers.length === 0,
            contractPresent: true,
            missingLayers,
            blockedExternalDependencies: reality.blockedExternalDependencies,
        };
    }

    private readRealityEvidence(root: string, missingLayers: string[], blockedExternalDependencies: string[]) {
        const path = join(root, this.realityEvidencePath);
        if (!existsSync(path)) {
            missingLayers.push("commercial-reality-evidence");
            return { blockedExternalDependencies };
        }

        let evidence: CommercialRealityEvidence;
        try {
            evidence = JSON.parse(readFileSync(path, "utf8")) as CommercialRealityEvidence;
        } catch {
            missingLayers.push("commercial-reality-evidence-invalid-json");
            return { blockedExternalDependencies };
        }

        if (evidence.schemaVersion !== 1) missingLayers.push("commercial-reality-evidence-schema");
        if (evidence.status !== "VERIFIED") missingLayers.push("commercial-reality-evidence-status");
        if (!evidence.commit) missingLayers.push("commercial-reality-evidence-commit");

        if (existsSync(join(root, ".git")) && evidence.commit) {
            try {
                const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
                if (head !== evidence.commit) missingLayers.push("commercial-reality-evidence-commit-mismatch");
            } catch {
                missingLayers.push("commercial-reality-evidence-git-binding");
            }
        }

        if (!evidence.commands?.length || evidence.commands.some(command => command.exitCode !== 0)) {
            missingLayers.push("commercial-command-evidence");
        }

        const installer = evidence.artifacts?.installer;
        if (!installer?.path || !installer.sha256 || !installer.sizeBytes || installer.sizeBytes <= 0) {
            missingLayers.push("commercial-artifact-evidence");
        }

        const runtime = evidence.runtime;
        if (!runtime?.installed || !runtime.launched || !runtime.health || !runtime.dashboard || !runtime.shellExitKeepsRuntime || !runtime.uninstall) {
            missingLayers.push("application-runtime-evidence");
        }

        const application = evidence.application;
        if (!application?.api || !application.ui || !application.representativeData) {
            missingLayers.push("application-behavior-evidence");
        }

        if (!evidence.persistence?.write || !evidence.persistence.restartReadback) {
            missingLayers.push("persistence-runtime-evidence");
        }

        const security = evidence.security;
        if (!security?.authentication || !security.authorization || !security.tenantIsolation || !security.audit) {
            missingLayers.push("security-runtime-evidence");
        }

        if (!evidence.acceptance?.userValuePath) missingLayers.push("acceptance-evidence");

        for (const dependency of evidence.externalDependencies ?? []) {
            if (dependency.required && dependency.status === "BLOCKED" && dependency.name) {
                if (!blockedExternalDependencies.includes(dependency.name)) blockedExternalDependencies.push(dependency.name);
            }
        }

        return { blockedExternalDependencies };
    }
}
