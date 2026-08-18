import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

export interface CommercialProductCompletionAuditResult {
    complete: boolean;
    contractPresent: boolean;
    missingLayers: string[];
    blockedExternalDependencies: string[];
}

interface CommercialRealityEvidence {
    schemaVersion?: number;
    status?: string;
    generatorId?: string;
    verificationMode?: string;
    generatedAt?: string;
    commit?: string;
    environmentId?: string;
    commands?: Array<{ name?: string; exitCode?: number; observedPostcondition?: boolean }>;
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

/** Fail-closed commercial product gate. */
export class CommercialProductCompletionAudit {
    private readonly contractPath = "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md";
    private readonly realityEvidencePath = "Docs/Evidence/commercial-product-reality.json";
    private readonly expectedGeneratorId = "HooshyarOS.RealityVerifier.v1";
    private readonly expectedVerificationMode = "BLACK_BOX_RUNTIME";

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

        this.readRealityEvidence(root, missingLayers, blockedExternalDependencies);
        return {
            complete: missingLayers.length === 0,
            contractPresent: true,
            missingLayers: [...new Set(missingLayers)],
            blockedExternalDependencies: [...new Set(blockedExternalDependencies)],
        };
    }

    private readRealityEvidence(root: string, missingLayers: string[], blockedExternalDependencies: string[]) {
        const path = join(root, this.realityEvidencePath);
        if (!existsSync(path)) {
            missingLayers.push("commercial-reality-evidence");
            return;
        }

        let evidence: CommercialRealityEvidence;
        try {
            evidence = JSON.parse(readFileSync(path, "utf8")) as CommercialRealityEvidence;
        } catch {
            missingLayers.push("commercial-reality-evidence-invalid-json");
            return;
        }

        if (evidence.schemaVersion !== 1) missingLayers.push("commercial-reality-evidence-schema");
        if (evidence.status !== "VERIFIED") missingLayers.push("commercial-reality-evidence-status");
        if (evidence.generatorId !== this.expectedGeneratorId) missingLayers.push("commercial-reality-evidence-generator");
        if (evidence.verificationMode !== this.expectedVerificationMode) missingLayers.push("commercial-reality-evidence-verification-mode");
        if (!evidence.generatedAt || Number.isNaN(Date.parse(evidence.generatedAt))) missingLayers.push("commercial-reality-evidence-timestamp");
        if (!evidence.environmentId) missingLayers.push("commercial-reality-evidence-environment");
        if (!evidence.commit) missingLayers.push("commercial-reality-evidence-commit");

        try {
            const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
            if (!evidence.commit || head !== evidence.commit) missingLayers.push("commercial-reality-evidence-commit-mismatch");
        } catch {
            missingLayers.push("commercial-reality-evidence-git-binding");
        }

        if (!evidence.commands?.length || evidence.commands.some(command => !command.name || command.exitCode !== 0 || command.observedPostcondition !== true)) {
            missingLayers.push("commercial-command-evidence");
        }

        const installer = evidence.artifacts?.installer;
        if (!installer?.path || !installer.sha256 || !installer.sizeBytes || installer.sizeBytes <= 0) {
            missingLayers.push("commercial-artifact-evidence");
        } else {
            this.verifyArtifact(root, installer.path, installer.sha256, installer.sizeBytes, missingLayers);
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
            if (dependency.required && dependency.name) {
                if (dependency.status === "BLOCKED") {
                    if (!blockedExternalDependencies.includes(dependency.name)) blockedExternalDependencies.push(dependency.name);
                    missingLayers.push(`external-dependency:${dependency.name}`);
                } else if (dependency.status !== "VERIFIED") {
                    missingLayers.push(`external-dependency-unverified:${dependency.name}`);
                }
            }
        }
    }

    private verifyArtifact(root: string, artifactPath: string, expectedSha256: string, expectedSize: number, missingLayers: string[]) {
        const rootPath = resolve(root);
        const target = resolve(root, artifactPath);
        const rel = relative(rootPath, target);
        const escapesRoot = rel === ".." || rel.startsWith(`..${sep}`) || resolve(rootPath, rel) !== target && rel.startsWith("..");
        if (escapesRoot) {
            missingLayers.push("commercial-artifact-path-escape");
            return;
        }
        if (!existsSync(target)) {
            missingLayers.push("commercial-artifact-missing");
            return;
        }
        try {
            const stat = statSync(target);
            if (stat.size !== expectedSize || stat.size <= 0) missingLayers.push("commercial-artifact-size-mismatch");
            const actualSha256 = createHash("sha256").update(readFileSync(target)).digest("hex");
            if (actualSha256.toLowerCase() !== expectedSha256.toLowerCase()) missingLayers.push("commercial-artifact-sha256-mismatch");
        } catch {
            missingLayers.push("commercial-artifact-verification-failed");
        }
    }
}
