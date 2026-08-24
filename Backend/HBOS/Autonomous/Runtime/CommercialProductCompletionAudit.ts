import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
export type CommercialEvidenceStatus = "VERIFIED" | "PARTIAL" | "MISSING";
export interface VerificationTestResult { path: string; passed: boolean; }
export interface VerificationEvidence { verified: boolean; fullVerify: boolean; focusedTest: string | null; executedTests?: string[]; testResults?: VerificationTestResult[]; }
export interface CommercialLayerEvidence { layer: string; status: CommercialEvidenceStatus; implementation: boolean; unit: boolean; integration: boolean; application: boolean; acceptance: boolean; reasons: string[]; }
export interface CommercialCompletionStates { assistantComplete: boolean; canonicalPlatformConstructionComplete: boolean; commercialProductRuntimeComplete: boolean; externalProductionDependenciesComplete: boolean; productComplete: boolean; }
export interface CommercialProductCompletionAuditResult { complete: boolean; contractPresent: boolean; missingLayers: string[]; blockedExternalDependencies: string[]; completionStates: CommercialCompletionStates; layers: CommercialLayerEvidence[]; }
type LayerSpec = [string, string[], string[], string[], string[], string[]];
export class CommercialProductCompletionAudit {
    private readonly contractPath = "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md";
    private readonly matrixPath = "Docs/AUDIT_COMMERCIAL_EVIDENCE_MATRIX.md";
    audit(root: string, verification?: VerificationEvidence): CommercialProductCompletionAuditResult {
        const contractFile = join(root, this.contractPath), matrixFile = join(root, this.matrixPath);
        if (!existsSync(contractFile) || !existsSync(matrixFile)) return this.result(false, existsSync(contractFile), ["commercial-evidence-contract"], []);
        const contract = readFileSync(contractFile, "utf8"), matrix = readFileSync(matrixFile, "utf8"), missingLayers: string[] = [];
        for (const marker of ["## Commercial completion layers", "## Evidence model", "## Completion states"]) if (!contract.includes(marker)) missingLayers.push(`contract-marker:${marker}`);
        if (!this.isCanonicalMatrix(matrix)) missingLayers.push("invalid-commercial-evidence-matrix");
        const layers = this.evaluateLayers(root, verification);
        for (const layer of layers) if (layer.status !== "VERIFIED") missingLayers.push(layer.layer);
        const blockedExternalDependencies: string[] = [];
        if (contract.includes("Payment-provider activation is an external dependency")) blockedExternalDependencies.push("payment-provider-activation");
        if (contract.includes("Cloud deployment may remain externally blocked")) blockedExternalDependencies.push("production-cloud-resources");
        const runtime = ["product-runtime", "identity-and-session", "authorization-and-tenant", "observability"].every(name => layers.find(l => l.layer === name)?.status === "VERIFIED") && this.hasCanonicalPersistenceEvidence(root, verification);
        const construction = layers.slice(3, 8).every(l => l.status === "VERIFIED");
        const assistant = this.anyExists(root, ["Backend/HBOS/Engines/AssistantEngine.ts"]) && this.verifiedTest(root, ["Backend/HBOS/test/Assistant.test.ts"], verification);
        const external = blockedExternalDependencies.length === 0;
        const productComplete = missingLayers.length === 0;
        return { complete: productComplete, contractPresent: true, missingLayers, blockedExternalDependencies, completionStates: { assistantComplete: assistant, canonicalPlatformConstructionComplete: construction, commercialProductRuntimeComplete: runtime, externalProductionDependenciesComplete: external, productComplete }, layers };
    }
    private isCanonicalMatrix(matrix: string): boolean {
        const required = ["# Commercial Evidence Matrix", "Canonical audit model for `CommercialProductCompletionAudit`.", "| Layer | Minimum evidence gate |", "Presence of an engine, directory, documentation file, or unit test alone is never sufficient for commercial completion."];
        const layers = ["Product runtime", "Identity", "Multi-tenancy/authorization", "Data ingestion", "Financial intelligence", "Executive intelligence", "Decision intelligence", "Organizational execution", "Dashboards/reports", "Web/mobile", "Offline/online", "Security/privacy", "Observability", "Deployment", "Subscription", "Onboarding"];
        return required.every(marker => matrix.includes(marker)) && layers.every(layer => matrix.includes(`| ${layer} |`));
    }
    private evaluateLayers(root: string, verification?: VerificationEvidence): CommercialLayerEvidence[] {
        const s: LayerSpec[] = [
            ["product-runtime", ["Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts"], ["Backend/HBOS/test/CommercialRuntimeServer.test.ts"], ["Backend/HBOS/test/CommercialRuntimeApplication.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["identity-and-session", ["Backend/HBOS/Product/CommercialIdentityService.ts", "Backend/HBOS/Security/AuthenticationService.ts"], ["Backend/HBOS/Product/CommercialIdentityService.test.ts"], ["Backend/HBOS/Security/AuthenticationService.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["authorization-and-tenant", ["Backend/HBOS/Security/AuthorizationService.ts", "Backend/HBOS/Autonomous/Analyzer/TenantIsolationEvidenceGate.ts"], ["Backend/HBOS/Security/AuthorizationService.test.ts"], ["Backend/HBOS/Autonomous/Analyzer/TenantIsolationEvidenceGate.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["canonical-data", ["Backend/HBOS/Product/FinancialDataIngestionAdapter.ts", "Backend/HBOS/Product/SQLitePersistenceStore.ts"], ["Backend/HBOS/Product/FinancialDataIngestionAdapter.test.ts"], ["Backend/HBOS/Engines/FinancialDataIngestionPersistence.integration.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["financial-intelligence", ["Backend/HBOS/Engines/FinancialIntelligenceEngine.ts"], ["Backend/HBOS/test/FinancialIntelligenceEngine.test.ts"], ["Backend/HBOS/test/FinancialIntelligence.integration.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["executive-intelligence", ["Backend/HBOS/Engines/ExecutiveIntelligenceEngine.ts"], ["Backend/HBOS/test/ExecutiveIntelligenceEngine.test.ts"], ["Backend/HBOS/test/ExecutiveIntelligence.integration.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["decision-intelligence", ["Backend/HBOS/Engines/DecisionEngine.ts"], ["Backend/HBOS/test/Decision.test.ts"], ["Backend/HBOS/test/Decision.test.ts"], ["Backend/HBOS/test/Decision.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["organizational-execution", ["Backend/HBOS/Engines/ProjectPilotEngine.ts"], ["Backend/HBOS/test/ProjectPilot.test.ts"], ["Backend/HBOS/test/ProjectPilot.test.ts"], ["Backend/HBOS/test/ProjectPilot.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["dashboards-and-reports", ["Backend/HBOS/Engines/DashboardEngine.ts", "Backend/HBOS/Engines/ReportsEngine.ts"], ["Backend/HBOS/test/DashboardEngine.test.ts", "Backend/HBOS/test/ReportsEngine.test.ts"], ["Backend/HBOS/test/DashboardReports.integration.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["web-application", ["web/index.html", "Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["offline-online", ["Backend/HBOS/Engines/OfflineOnlineEngine.ts"], ["Backend/HBOS/test/OfflineOnlineEngine.test.ts"], ["Backend/HBOS/test/OfflineOnline.integration.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["security-privacy", ["Backend/HBOS/Engines/SecurityLayerEngine.ts", "Backend/HBOS/Security/SecurityAuditStore.ts"], ["Backend/HBOS/test/SecurityLayerEngine.test.ts", "Backend/HBOS/Security/SecurityAuditStore.test.ts"], ["Backend/HBOS/Security/SecurityAuditStore.integration.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["observability", ["Backend/HBOS/Engines/ObservabilityEngine.ts"], ["Backend/HBOS/test/ObservabilityEngine.test.ts"], ["Backend/HBOS/test/Observability.integration.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["deployment", ["Backend/HBOS/Engines/DeploymentContractEngine.ts"], ["Backend/HBOS/test/DeploymentContractEngine.test.ts"], ["Backend/HBOS/test/DeploymentContract.integration.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["subscription-commercial-controls", ["Backend/HBOS/Engines/SubscriptionEngine.ts"], ["Backend/HBOS/test/SubscriptionEngine.test.ts"], ["Backend/HBOS/test/Subscription.integration.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["customer-onboarding", ["Backend/HBOS/Engines/OnboardingEngine.ts"], ["Backend/HBOS/test/OnboardingEngine.test.ts"], ["Backend/HBOS/test/Onboarding.integration.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]]
        ];
        return s.map(([layer, impl, unit, integration, application, acceptance]) => {
            const checks = [this.anyExists(root, impl), this.verifiedTest(root, unit, verification), this.verifiedTest(root, integration, verification), this.verifiedTest(root, application, verification), this.verifiedTest(root, acceptance, verification)];
            const labels = ["implementation", "unit", "integration", "application", "acceptance"], score = checks.filter(Boolean).length;
            return { layer, status: score === 5 ? "VERIFIED" : score ? "PARTIAL" : "MISSING", implementation: checks[0], unit: checks[1], integration: checks[2], application: checks[3], acceptance: checks[4], reasons: checks.map((ok, i) => ok ? "" : labels[i]).filter(Boolean) };
        });
    }
    private verifiedTest(root: string, paths: string[], verification?: VerificationEvidence): boolean {
        if (!verification?.verified) return false;
        const existing = paths.filter(p => existsSync(join(root, p))).map(p => p.replace(/\\/g, "/"));
        if (!existing.length) return false;
        const results = verification.testResults ?? [];
        if (results.length) return existing.some(p => results.some(r => r.passed && r.path.replace(/\\/g, "/") === p));
        if (verification.fullVerify) return false;
        const executed = new Set((verification.executedTests ?? []).map(p => p.replace(/\\/g, "/")));
        if (verification.focusedTest) executed.add(verification.focusedTest.replace(/\\/g, "/"));
        return existing.some(p => executed.has(p));
    }
    private anyExists(root: string, paths: string[]): boolean { return paths.some(p => existsSync(join(root, p))); }
    private hasCanonicalPersistenceEvidence(root: string, v?: VerificationEvidence): boolean { return this.anyExists(root, ["Backend/HBOS/Product/CommercialPersistenceBoundary.ts", "Backend/HBOS/Product/SQLitePersistenceStore.ts"]) && this.verifiedTest(root, ["Backend/HBOS/Product/FinancialDataIngestionAdapter.test.ts"], v) && this.verifiedTest(root, ["Backend/HBOS/Engines/FinancialDataIngestionPersistence.integration.test.ts"], v); }
    private result(complete: boolean, contractPresent: boolean, missingLayers: string[], blockedExternalDependencies: string[]): CommercialProductCompletionAuditResult { return { complete, contractPresent, missingLayers, blockedExternalDependencies, completionStates: { assistantComplete: false, canonicalPlatformConstructionComplete: false, commercialProductRuntimeComplete: false, externalProductionDependenciesComplete: !blockedExternalDependencies.length, productComplete: complete }, layers: [] }; }
}
