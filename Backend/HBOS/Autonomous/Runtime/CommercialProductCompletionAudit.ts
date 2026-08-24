import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
}

export class CommercialProductCompletionAudit {
    private readonly contractPath = "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md";

    audit(root: string): CommercialProductCompletionAuditResult {
        const contractFile = join(root, this.contractPath);
        if (!existsSync(contractFile)) return this.result(false, false, ["commercial-completion-contract"], []);

        const contract = readFileSync(contractFile, "utf8");
        const missingLayers: string[] = [];
        const requiredContractMarkers = [
            "## Commercial completion layers",
            "### 1. Product runtime",
            "### 2. Identity, users and organizations",
            "### 3. Multi-tenancy and authorization",
            "### 4. Data ingestion and canonical data",
            "### 5. Financial intelligence",
            "### 6. Executive and managerial intelligence",
            "### 7. Decision intelligence and Expert Choice",
            "### 8. Organizational execution",
            "### 9. Dashboards and reports",
            "### 10. Web and mobile",
            "### 11. Offline/online behavior",
            "### 12. Security and privacy",
            "### 13. Observability and operations",
            "### 14. Deployment and installation",
            "### 15. Subscription and commercial controls",
            "### 16. Customer onboarding",
            "## Evidence model",
            "## Completion states"
        ];
        for (const marker of requiredContractMarkers) if (!contract.includes(marker)) missingLayers.push(`contract-marker:${marker}`);

        const gates: Array<[string, boolean]> = [
            ["product-runtime", this.hasProductRuntimeEvidence(root)],
            ["identity-and-session-evidence", this.hasIdentityEvidence(root)],
            ["authorization-and-tenant-evidence", this.hasAuthorizationEvidence(root)],
            ["canonical-data-evidence", this.hasCanonicalDataEvidence(root)],
            ["financial-intelligence-evidence", this.hasFinancialIntelligenceEvidence(root)],
            ["executive-intelligence-evidence", this.hasExecutiveIntelligenceEvidence(root)],
            ["decision-intelligence-evidence", this.hasDecisionIntelligenceEvidence(root)],
            ["organizational-execution-evidence", this.hasOrganizationalExecutionEvidence(root)],
            ["dashboard-report-application-evidence", this.hasDashboardReportEvidence(root)],
            ["web-application-evidence", this.hasWebApplicationEvidence(root)],
            ["offline-online-evidence", this.hasOfflineOnlineEvidence(root)],
            ["security-privacy-evidence", this.hasSecurityPrivacyEvidence(root)],
            ["observability-operations-evidence", this.hasObservabilityEvidence(root)],
            ["deployment-installation-evidence", this.hasDeploymentEvidence(root)],
            ["subscription-commercial-controls-evidence", this.hasSubscriptionEvidence(root)],
            ["customer-onboarding-evidence", this.hasCustomerOnboardingEvidence(root)]
        ];
        for (const [layer, verified] of gates) if (!verified) missingLayers.push(layer);

        const blockedExternalDependencies: string[] = [];
        if (contract.includes("Payment-provider activation is an external dependency")) blockedExternalDependencies.push("payment-provider-activation");
        if (contract.includes("Cloud deployment may remain externally blocked")) blockedExternalDependencies.push("production-cloud-resources");

        const productRuntimeComplete = gates.slice(0, 3).every(([, verified]) => verified) && this.hasCanonicalPersistenceEvidence(root) && this.hasObservabilityEvidence(root);
        const canonicalPlatformConstructionComplete = gates.slice(3, 8).every(([, verified]) => verified);
        const assistantComplete = this.hasAssistantEvidence(root);
        const externalProductionDependenciesComplete = blockedExternalDependencies.length === 0;
        const productComplete = missingLayers.length === 0 && externalProductionDependenciesComplete;

        return {
            complete: productComplete,
            contractPresent: true,
            missingLayers,
            blockedExternalDependencies,
            completionStates: {
                assistantComplete,
                canonicalPlatformConstructionComplete,
                commercialProductRuntimeComplete: productRuntimeComplete,
                externalProductionDependenciesComplete,
                productComplete
            }
        };
    }

    private result(complete: boolean, contractPresent: boolean, missingLayers: string[], blockedExternalDependencies: string[]): CommercialProductCompletionAuditResult {
        return {
            complete,
            contractPresent,
            missingLayers,
            blockedExternalDependencies,
            completionStates: {
                assistantComplete: false,
                canonicalPlatformConstructionComplete: false,
                commercialProductRuntimeComplete: false,
                externalProductionDependenciesComplete: blockedExternalDependencies.length === 0,
                productComplete: complete
            }
        };
    }

    private hasAssistantEvidence(root: string): boolean {
        return this.hasImplementationAndBehaviorTest(root, "Backend/HBOS/Engines/AssistantEngine.ts", "Backend/HBOS/test/Assistant.test.ts");
    }

    private hasProductRuntimeEvidence(root: string): boolean {
        const packagePath = join(root, "package.json");
        const runtimePath = join(root, "Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts");
        if (!existsSync(packagePath) || !existsSync(runtimePath)) return false;
        const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as { scripts?: Record<string, string> };
        const scripts = packageJson.scripts ?? {};
        const runnable = Boolean(scripts.start || scripts.dev || scripts.serve || scripts.preview);
        const webArtifacts = ["web/index.html", "web/app.js", "web/styles.css", "web/manifest.webmanifest"];
        return (runnable || webArtifacts.every(artifact => existsSync(join(root, artifact)))) && this.hasWebApplicationEvidence(root) && this.hasCanonicalPersistenceEvidence(root) && this.hasObservabilityEvidence(root);
    }

    private hasIdentityEvidence(root: string): boolean {
        return this.hasBehavioralContract(root, "Backend/HBOS/Engines/UserManagementEngine.ts", "Backend/HBOS/test/UserManagement.test.ts", ["registerUser", "session", "logout", "invalidate"]);
    }

    private hasAuthorizationEvidence(root: string): boolean {
        return this.hasBehavioralContract(root, "Backend/HBOS/Engines/SecurityLayerEngine.ts", "Backend/HBOS/test/SecurityLayerEngine.test.ts", ["authorize", "role", "permission", "tenant", "cross-tenant"]);
    }

    private hasCanonicalDataEvidence(root: string): boolean {
        return this.hasImplementationAndBehaviorTest(root, "Backend/HBOS/Product/FinancialDataIngestionAdapter.ts", "Backend/HBOS/Product/FinancialDataIngestionAdapter.test.ts") &&
            existsSync(join(root, "Backend/HBOS/test/FinancialDataIngestionPersistence.integration.test.ts"));
    }

    private hasFinancialIntelligenceEvidence(root: string): boolean {
        return this.hasImplementationAndBehaviorTest(root, "Backend/HBOS/Engines/FinancialIntelligenceEngine.ts", "Backend/HBOS/test/FinancialIntelligenceEngine.test.ts");
    }

    private hasExecutiveIntelligenceEvidence(root: string): boolean {
        return this.hasImplementationAndBehaviorTest(root, "Backend/HBOS/Engines/ExecutiveIntelligenceEngine.ts", "Backend/HBOS/test/ExecutiveIntelligenceEngine.test.ts");
    }

    private hasDecisionIntelligenceEvidence(root: string): boolean {
        return this.hasImplementationAndBehaviorTest(root, "Backend/HBOS/Engines/DecisionEngine.ts", "Backend/HBOS/test/Decision.test.ts") &&
            this.hasTestContaining(root, "Backend/HBOS/test/Decision.test.ts", ["scenario", "recommendation", "approval"]);
    }

    private hasOrganizationalExecutionEvidence(root: string): boolean {
        return this.hasImplementationAndBehaviorTest(root, "Backend/HBOS/Engines/ProjectPilotEngine.ts", "Backend/HBOS/test/ProjectPilot.test.ts") &&
            this.hasTestContaining(root, "Backend/HBOS/test/ProjectPilot.test.ts", ["decision", "task", "workflow"]);
    }

    private hasDashboardReportEvidence(root: string): boolean {
        return this.hasImplementationAndBehaviorTest(root, "Backend/HBOS/Engines/DashboardEngine.ts", "Backend/HBOS/test/DashboardEngine.test.ts") &&
            this.hasImplementationAndBehaviorTest(root, "Backend/HBOS/Engines/ReportsEngine.ts", "Backend/HBOS/test/ReportsEngine.test.ts") &&
            this.hasWebApplicationEvidence(root);
    }

    private hasWebApplicationEvidence(root: string): boolean {
        const testPaths = ["Backend/HBOS/test/CommercialRuntimeServer.test.ts", "Backend/HBOS/test/CommercialRuntimeApplication.test.ts", "Backend/HBOS/test/CommercialWebApplication.test.ts"];
        return testPaths.some(path => {
            const file = join(root, path);
            if (!existsSync(file)) return false;
            const test = readFileSync(file, "utf8");
            return ["createCommercialRuntimeServer", "request(", "expect(", "status"].every(marker => test.includes(marker));
        });
    }

    private hasCanonicalPersistenceEvidence(root: string): boolean {
        const boundaryPath = join(root, "Backend/HBOS/Product/CommercialPersistenceBoundary.ts");
        const adapterPath = join(root, "Backend/HBOS/Product/SQLitePersistenceStore.ts");
        const behaviorTestPath = join(root, "Backend/HBOS/Product/FinancialDataIngestionAdapter.test.ts");
        if (!existsSync(boundaryPath) || !existsSync(adapterPath) || !existsSync(behaviorTestPath)) return false;
        const boundary = readFileSync(boundaryPath, "utf8");
        const adapter = readFileSync(adapterPath, "utf8");
        const behaviorTest = readFileSync(behaviorTestPath, "utf8");
        return [
            ["interface TenantScope", "interface PersistenceRecord", "interface PersistenceStore", "read(scope: TenantScope", "write(scope: TenantScope", "persistence-tenant-scope-required"],
            ["implements PersistenceStore", "DatabaseSync", "CREATE TABLE IF NOT EXISTS persistence_records", "tenant_id TEXT NOT NULL", "read(scope: TenantScope", "write(scope: TenantScope", "WHERE tenant_id = ? AND key = ?"],
            ["SQLitePersistenceStore", "survives database restart", "database.close()", "new SQLitePersistenceStore({ databasePath })", "tenant-scoped"]
        ].every((markers, index) => markers.every(marker => [boundary, adapter, behaviorTest][index].includes(marker)));
    }

    private hasOfflineOnlineEvidence(root: string): boolean {
        const testPath = join(root, "Backend/HBOS/test/CommercialWebApplication.test.ts");
        return existsSync(join(root, "web")) && existsSync(testPath) && this.hasTestContaining(root, "Backend/HBOS/test/CommercialWebApplication.test.ts", ["offline", "online", "sync"]);
    }

    private hasSecurityPrivacyEvidence(root: string): boolean {
        const testCandidates = ["Backend/HBOS/test/SecurityLayerEngine.test.ts", "Backend/HBOS/test/Security.test.ts", "Backend/HBOS/test/HealthMonitor.test.ts"];
        return ["Backend/HBOS/Security", "Backend/HBOS/Auth", "Backend/HBOS/Identity"].some(dir => existsSync(join(root, dir))) &&
            existsSync(join(root, "Docs/SECURITY.md")) && testCandidates.some(path => existsSync(join(root, path)));
    }

    private hasObservabilityEvidence(root: string): boolean {
        const runtime = join(root, "Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts");
        if (!existsSync(runtime)) return false;
        const source = readFileSync(runtime, "utf8");
        return ["/health", "/api/ready"].every(marker => source.includes(marker)) && this.hasWebApplicationEvidence(root);
    }

    private hasDeploymentEvidence(root: string): boolean {
        return this.hasImplementationAndBehaviorTest(root, "Backend/HBOS/Engines/DeploymentContractEngine.ts", "Backend/HBOS/test/DeploymentContractEngine.test.ts") && existsSync(join(root, "package.json"));
    }

    private hasSubscriptionEvidence(root: string): boolean {
        return this.hasImplementationAndBehaviorTest(root, "Backend/HBOS/Engines/SubscriptionEngine.ts", "Backend/HBOS/test/SubscriptionEngine.test.ts") && this.hasWebApplicationEvidence(root);
    }

    private hasCustomerOnboardingEvidence(root: string): boolean {
        return this.hasImplementationAndBehaviorTest(root, "Backend/HBOS/Engines/OnboardingEngine.ts", "Backend/HBOS/test/OnboardingEngine.test.ts") && this.hasWebApplicationEvidence(root);
    }

    private hasImplementationAndBehaviorTest(root: string, implementationPath: string, testPath: string): boolean {
        return existsSync(join(root, implementationPath)) && existsSync(join(root, testPath));
    }

    private hasBehavioralContract(root: string, implementationPath: string, testPath: string, markers: string[]): boolean {
        if (!this.hasImplementationAndBehaviorTest(root, implementationPath, testPath)) return false;
        const source = readFileSync(join(root, implementationPath), "utf8");
        const test = readFileSync(join(root, testPath), "utf8");
        return markers.every(marker => source.includes(marker) && test.includes(marker)) && /expect\(/.test(test);
    }

    private hasTestContaining(root: string, testPath: string, markers: string[]): boolean {
        const file = join(root, testPath);
        if (!existsSync(file)) return false;
        const test = readFileSync(file, "utf8");
        return markers.every(marker => test.toLowerCase().includes(marker.toLowerCase())) && /expect\(/.test(test);
    }
}
