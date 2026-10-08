import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CapabilityEvidenceAudit, EvidenceLevelStatus } from "./CapabilityEvidenceAudit";
import { ExternalProductionDependencyAudit } from "./ExternalProductionDependencyAudit";

export interface CommercialProductCompletionAuditResult {
    complete: boolean;
    contractPresent: boolean;
    missingLayers: string[];
    blockedExternalDependencies: string[];
    /** Level 3 (application) evidence status. */
    applicationEvidence: EvidenceLevelStatus;
    /** Level 4 (acceptance) evidence status. */
    acceptanceEvidence: EvidenceLevelStatus;
    /** Fail-closed reasons derived from the completion-integrity gate. */
    evidenceGaps: string[];
}

export interface CommercialProductCompletionAuditOptions {
    /** Trusted checkpoint the evidence must be bound to. Defaults to the repository HEAD. */
    currentCommit?: string;
}

/**
 * Canonical machine-verifiable application/acceptance evidence produced by the
 * existing product acceptance harnesses (never hand-authored). Each surface
 * success artifact is bound to the commit it exercised.
 */
interface ApplicationSurface {
    id: string;
    path: string;
    type: string;
    commitKey: string;
    acceptanceKey: string;
}

const APPLICATION_SURFACES: ApplicationSurface[] = [
    { id: "web-application", path: ".hooshyar/web-acceptance-success.json", type: "WEB_PRODUCT_ACCEPTANCE_SUCCESS", commitKey: "commit", acceptanceKey: "acceptance" },
    { id: "security-application", path: ".hooshyar/security-acceptance-success.json", type: "SECURITY_TENANT_ACCEPTANCE_SUCCESS", commitKey: "commit", acceptanceKey: "acceptance" }
];

function isResolvedCommit(value: unknown): value is string {
    return typeof value === "string" && /^[0-9a-f]{7,40}$/i.test(value.trim());
}

/**
 * Evidence must be produced against the trusted checkpoint being claimed. A short
 * commit may be compared with its full form, but an absent, unknown, mismatching or
 * unresolvable commit is stale by definition and therefore never completion.
 */
function commitIsFresh(evidenceCommit: unknown, currentCommit: string): boolean {
    if (!isResolvedCommit(evidenceCommit) || !isResolvedCommit(currentCommit)) return false;
    const evidence = evidenceCommit.trim().toLowerCase();
    const current = currentCommit.trim().toLowerCase();
    return evidence === current || evidence.startsWith(current) || current.startsWith(evidence);
}

function resolveRepositoryCommit(root: string): string {
    try {
        return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
        return "";
    }
}

export class CommercialProductCompletionAudit {
    private readonly contractPath = "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md";
    private readonly externalDependencies = new ExternalProductionDependencyAudit();
    private readonly evidenceAudit = new CapabilityEvidenceAudit();

    audit(root: string, options: CommercialProductCompletionAuditOptions = {}): CommercialProductCompletionAuditResult {
        const currentCommit = options.currentCommit ?? resolveRepositoryCommit(root);
        const contractFile = join(root, this.contractPath);
        if (!existsSync(contractFile)) {
            return {
                complete: false,
                contractPresent: false,
                missingLayers: ["commercial-completion-contract"],
                blockedExternalDependencies: [],
                applicationEvidence: this.missingEvidence(APPLICATION_SURFACES.map(surface => surface.path).join(", ")),
                acceptanceEvidence: this.missingEvidence(APPLICATION_SURFACES.map(surface => surface.path).join(", ")),
                evidenceGaps: ["commercial-completion-contract-missing"]
            };
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

        const externalEvidence = this.externalDependencies.audit(process.env);
        const blockedExternalDependencies = externalEvidence
            .filter(item => item.status === "BLOCKED")
            .map(item => item.id);

        // Level 3/4 evidence: a structurally complete tree or a marker string is never
        // sufficient. Application and acceptance evidence must be present, verified,
        // commit-fresh and not blocked.
        const applicationEvidence = this.readApplicationEvidence(root, currentCommit);
        const acceptanceEvidence = this.readAcceptanceEvidence(root, currentCommit);
        const gate = this.evidenceAudit.evaluateCompletion({
            capabilityId: "platform.commercial-product",
            base: { implementation: true, test: true, documentation: true, dependenciesSatisfied: true, verified: true },
            unit: { present: true, passed: true, fresh: true, artifact: "contract-unit-evidence" },
            integration: { present: true, passed: true, fresh: true, artifact: "contract-integration-evidence" },
            application: applicationEvidence,
            acceptance: acceptanceEvidence,
            externalBlocked: blockedExternalDependencies.length > 0
        });

        return {
            complete: missingLayers.length === 0 && gate.complete,
            contractPresent: true,
            missingLayers,
            blockedExternalDependencies,
            applicationEvidence,
            acceptanceEvidence,
            evidenceGaps: gate.nonCompleteReasons
        };
    }

    private missingEvidence(artifact: string): EvidenceLevelStatus {
        return { present: false, passed: false, fresh: false, artifact, detail: "evidence-missing" };
    }

    private readJson(root: string, relativePath: string): { record: Record<string, unknown> | null; present: boolean } {
        const file = join(root, relativePath);
        if (!existsSync(file)) return { record: null, present: false };
        try {
            const parsed = JSON.parse(readFileSync(file, "utf8"));
            return { record: parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null, present: true };
        } catch {
            return { record: null, present: true };
        }
    }

    private readApplicationEvidence(root: string, currentCommit: string): EvidenceLevelStatus {
        const artifact = APPLICATION_SURFACES.map(surface => surface.path).join(", ");
        const entries = APPLICATION_SURFACES.map(surface => ({ surface, ...this.readJson(root, surface.path) }));
        if (entries.some(entry => !entry.present)) return this.missingEvidence(artifact);
        if (entries.some(entry => !entry.record)) return { present: true, passed: false, fresh: false, artifact, detail: "application-evidence-malformed" };

        const blocked = entries.some(entry => entry.record!.status === "BLOCKED");
        const passed = entries.every(entry => entry.record!.type === entry.surface.type && entry.record!.status === "PASS");
        const fresh = entries.every(entry => commitIsFresh(entry.record![entry.surface.commitKey], currentCommit));

        return {
            present: true,
            passed,
            fresh: !blocked && fresh,
            blocked,
            artifact,
            detail: blocked ? "application-evidence-blocked" : passed ? "application-evidence-passed" : "application-evidence-unverified"
        };
    }

    private readAcceptanceEvidence(root: string, currentCommit: string): EvidenceLevelStatus {
        const artifact = APPLICATION_SURFACES.map(surface => surface.path).join(", ");
        const entries = APPLICATION_SURFACES.map(surface => ({ surface, ...this.readJson(root, surface.path) }));
        if (entries.some(entry => !entry.present)) return this.missingEvidence(artifact);
        if (entries.some(entry => !entry.record)) return { present: true, passed: false, fresh: false, artifact, detail: "acceptance-evidence-malformed" };

        const hasEndToEndEvidence = (record: Record<string, unknown>, surface: ApplicationSurface): boolean => {
            const acceptance = record[surface.acceptanceKey];
            return Array.isArray(acceptance) && acceptance.length > 0;
        };
        const passed = entries.every(entry => entry.record!.type === entry.surface.type && entry.record!.status === "PASS" && hasEndToEndEvidence(entry.record!, entry.surface));
        const fresh = entries.every(entry => commitIsFresh(entry.record![entry.surface.commitKey], currentCommit));

        return {
            present: true,
            passed,
            fresh: passed && fresh,
            blocked: false,
            artifact,
            detail: passed ? "acceptance-evidence-passed" : "acceptance-evidence-unverified"
        };
    }
}
