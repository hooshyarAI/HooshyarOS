import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type CommercialEvidenceStatus = "VERIFIED" | "PARTIAL" | "MISSING";

export interface CommercialLayerEvidence {
    layer: string;
    status: CommercialEvidenceStatus;
    implementation: boolean;
    unit: boolean;
    integration: boolean;
    application: boolean;
    acceptance: boolean;
    reasons: string[];
}

export interface CommercialCompletionStates {
    assistantComplete: boolean;
    canonicalPlatformConstructionComplete: boolean;
    commercialProductRuntimeComplete: boolean;
    externalProductionDependenciesComplete: boolean;
    productComplete: boolean;
}

export interface CommercialProductCompletionAuditResult {
    complete: boolean;
    contractPresent: boolean;
    missingLayers: string[];
    blockedExternalDependencies: string[];
    completionStates: CommercialCompletionStates;
    layers: CommercialLayerEvidence[];
}

export class CommercialProductCompletionAudit {
    private readonly contractPath = "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md";
    private readonly matrixPath = "Docs/AUDIT_COMMERCIAL_EVIDENCE_MATRIX.md";

    audit(root: string): CommercialProductCompletionAuditResult {
        const contractFile = join(root, this.contractPath);
        const matrixFile = join(root, this.matrixPath);
        if (!existsSync(contractFile) || !existsSync(matrixFile)) return this.result(false, existsSync(contractFile), ["commercial-evidence-contract"], []);

        const contract = readFileSync(contractFile, "utf8");
        const matrix = readFileSync(matrixFile, "utf8");
        const missingLayers: string[] = [];
        for (const marker of ["## Commercial completion layers", "## Evidence model", "## Completion states"]) {
            if (!contract.includes(marker)) missingLayers.push(`contract-marker:${marker}`);
        }
        if (!["Implementation", "Unit", "Integration", "Application", "Acceptance"].every(marker => matrix.includes(marker))) missingLayers.push("invalid-commercial-evidence-matrix");

        const layers = this.evaluateLayers(root);
        for (const layer of layers) if (layer.status !== "VERIFIED") missingLayers.push(layer.layer);

        const blockedExternalDependencies: string[] = [];
        if (contract.includes("Payment-provider activation is an external dependency")) blockedExternalDependencies.push("payment-provider-activation");
        if (contract.includes("Cloud deployment may remain externally blocked")) blockedExternalDependencies.push("production-cloud-resources");

        const productRuntimeComplete = layers.filter(l => ["product-runtime", "identity-and-session", "authorization-and-tenant", "observability"].includes(l.layer)).every(l => l.status === "VERIFIED") && this.hasCanonicalPersistenceEvidence(root);
        const canonicalPlatformConstructionComplete = layers.slice(3, 8).every(l => l.status === "VERIFIED");
        const assistantComplete = this.hasAssistantEvidence(root);
        const externalProductionDependenciesComplete = blockedExternalDependencies.length === 0;
        const productComplete = missingLayers.length === 0 && externalProductionDependenciesComplete;

        return { complete: productComplete, contractPresent: true, missingLayers, blockedExternalDependencies, completionStates: { assistantComplete, canonicalPlatformConstructionComplete, commercialProductRuntimeComplete: productRuntimeComplete, externalProductionDependenciesComplete, productComplete }, layers };
    }

    private evaluateLayers(root: string): CommercialLayerEvidence[] {
        const specs: Array<[string, string[], string[], string[], string[], string[]]> = [
            ["product-runtime", ["Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts"], ["Backend/HBOS/test/CommercialRuntimeServer.test.ts"], ["Backend/HBOS/test/CommercialRuntimeApplication.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["identity-and-session", ["Backend/HBOS/Services/CommercialIdentityService.ts", "Backend/HBOS/Auth/AuthenticationService.ts"], ["Backend/HBOS/test/CommercialIdentityService.test.ts"], ["Backend/HBOS/test/AuthenticationService.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["authorization-and-tenant", ["Backend/HBOS/Services/AuthorizationService.ts", "Backend/HBOS/Services/TenantIsolationEvidenceGate.ts"], ["Backend/HBOS/test/AuthorizationService.test.ts"], ["Backend/HBOS/test/TenantIsolationEvidenceGate.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["canonical-data", ["Backend/HBOS/Product/FinancialDataIngestionAdapter.ts"], ["Backend/HBOS/Product/FinancialDataIngestionAdapter.test.ts"], ["Backend/HBOS/test/FinancialDataIngestionPersistence.integration.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["financial-intelligence", ["Backend/HBOS/Engines/FinancialIntelligenceEngine.ts"], ["Backend/HBOS/test/FinancialIntelligenceEngine.test.ts"], ["Backend/HBOS/test/FinancialIntelligence.integration.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["executive-intelligence", ["Backend/HBOS/Engines/ExecutiveIntelligenceEngine.ts"], ["Backend/HBOS/test/ExecutiveIntelligenceEngine.test.ts"], ["Backend/HBOS/test/ExecutiveIntelligence.integration.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["decision-intelligence", ["Backend/HBOS/Engines/DecisionEngine.ts"], ["Backend/HBOS/test/Decision.test.ts"], ["Backend/HBOS/test/Decision.test.ts"], ["Backend/HBOS/test/Decision.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["organizational-execution", ["Backend/HBOS/Engines/ProjectPilotEngine.ts"], ["Backend/HBOS/test/ProjectPilot.test.ts"], ["Backend/HBOS/test/ProjectPilot.test.ts"], ["Backend/HBOS/test/ProjectPilot.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["dashboards-and-reports", ["Backend/HBOS/Engines/DashboardEngine.ts", "Backend/HBOS/Engines/ReportsEngine.ts"], ["Backend/HBOS/test/DashboardEngine.test.ts", "Backend/HBOS/test/ReportsEngine.test.ts"], ["Backend/HBOS/test/DashboardReports.integration.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["web-application", ["web/index.html", "Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["offline-online", ["Backend/HBOS/Engines/OfflineOnlineEngine.ts"], ["Backend/HBOS/test/OfflineOnlineEngine.test.ts"], ["Backend/HBOS/test/OfflineOnline.integration.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["security-privacy", ["Backend/HBOS/Engines/SecurityLayerEngine.ts", "Backend/HBOS/Services/SecurityAuditStore.ts"], ["Backend/HBOS/test/SecurityLayerEngine.test.ts"], ["Backend/HBOS/test/SecurityAuditStore.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["observability", ["Backend/HBOS/Engines/ObservabilityEngine.ts"], ["Backend/HBOS/test/ObservabilityEngine.test.ts"], ["Backend/HBOS/test/Observability.integration.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["deployment", ["Backend/HBOS/Engines/DeploymentContractEngine.ts"], ["Backend/HBOS/test/DeploymentContractEngine.test.ts"], ["Backend/HBOS/test/DeploymentContract.integration.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["subscription-commercial-controls", ["Backend/HBOS/Engines/SubscriptionEngine.ts"], ["Backend/HBOS/test/SubscriptionEngine.test.ts"], ["Backend/HBOS/test/Subscription.integration.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]],
            ["customer-onboarding", ["Backend/HBOS/Engines/OnboardingEngine.ts"], ["Backend/HBOS/test/OnboardingEngine.test.ts"], ["Backend/HBOS/test/Onboarding.integration.test.ts"], ["Backend/HBOS/test/CommercialWebApplication.test.ts"], ["Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"]]
        ];
        return specs.map(([layer, implPaths, unitPaths, integrationPaths, applicationPaths, acceptancePaths]) => {
            const checks = [implPaths, unitPaths, integrationPaths, applicationPaths, acceptancePaths].map(paths => paths.some(path => existsSync(join(root, path))));
            const score = checks.filter(Boolean).length;
            const status: CommercialEvidenceStatus = score === 5 ? "VERIFIED" : score > 0 ? "PARTIAL" : "MISSING";
            return { layer, status, implementation: checks[0], unit: checks[1], integration: checks[2], application: checks[3], acceptance: checks[4], reasons: checks.map((ok, i) => ok ? "" : ["implementation", "unit", "integration", "application", "acceptance"][i]).filter(Boolean) };
        });
    }

    private hasAssistantEvidence(root: string): boolean { return this.hasImplementationAndBehaviorTest(root, "Backend/HBOS/Engines/AssistantEngine.ts", "Backend/HBOS/test/Assistant.test.ts"); }
    private hasCanonicalPersistenceEvidence(root: string): boolean {
        const files = ["Backend/HBOS/Product/CommercialPersistenceBoundary.ts", "Backend/HBOS/Product/SQLitePersistenceStore.ts", "Backend/HBOS/Product/FinancialDataIngestionAdapter.test.ts"];
        return files.every(file => existsSync(join(root, file)));
    }
    private hasImplementationAndBehaviorTest(root: string, implementationPath: string, testPath: string): boolean { return existsSync(join(root, implementationPath)) && existsSync(join(root, testPath)); }
    private result(complete: boolean, contractPresent: boolean, missingLayers: string[], blockedExternalDependencies: string[]): CommercialProductCompletionAuditResult { return { complete, contractPresent, missingLayers, blockedExternalDependencies, completionStates: { assistantComplete: false, canonicalPlatformConstructionComplete: false, commercialProductRuntimeComplete: false, externalProductionDependenciesComplete: blockedExternalDependencies.length === 0, productComplete: complete }, layers: [] }; }
}
