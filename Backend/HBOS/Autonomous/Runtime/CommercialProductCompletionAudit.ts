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
        if (!existsSync(contractFile)) {
            return {
                complete: false,
                contractPresent: false,
                missingLayers: ["commercial-completion-contract"],
                blockedExternalDependencies: [],
                completionStates: {
                    assistantComplete: false,
                    canonicalPlatformConstructionComplete: false,
                    commercialProductRuntimeComplete: false,
                    externalProductionDependenciesComplete: false,
                    productComplete: false
                }
            };
        }

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
        for (const marker of requiredContractMarkers) {
            if (!contract.includes(marker)) missingLayers.push(`contract-marker:${marker}`);
        }

        const productRuntimeEvidence = this.hasProductRuntimeEvidence(root);
        if (!productRuntimeEvidence) missingLayers.push("product-runtime");

        const identityEvidence = this.hasIdentityEvidence(root);
        if (!identityEvidence) missingLayers.push("identity-and-session-evidence");

        const authorizationEvidence = this.hasAuthorizationEvidence(root);
        if (!authorizationEvidence) missingLayers.push("authorization-and-tenant-evidence");

        if (!this.hasCanonicalDataEvidence(root)) missingLayers.push("canonical-data-evidence");
        if (!this.hasFinancialIntelligenceEvidence(root)) missingLayers.push("financial-intelligence-evidence");
        if (!this.hasExecutiveIntelligenceEvidence(root)) missingLayers.push("executive-intelligence-evidence");
        if (!this.hasDecisionIntelligenceEvidence(root)) missingLayers.push("decision-intelligence-evidence");
        if (!this.hasOrganizationalExecutionEvidence(root)) missingLayers.push("organizational-execution-evidence");
        if (!this.hasDashboardReportEvidence(root)) missingLayers.push("dashboard-report-application-evidence");
        if (!this.hasWebApplicationEvidence(root)) missingLayers.push("web-application-evidence");
        if (!this.hasOfflineOnlineEvidence(root)) missingLayers.push("offline-online-evidence");
        if (!this.hasSecurityPrivacyEvidence(root)) missingLayers.push("security-privacy-evidence");
        if (!this.hasObservabilityEvidence(root)) missingLayers.push("observability-operations-evidence");
        if (!this.hasDeploymentEvidence(root)) missingLayers.push("deployment-installation-evidence");
        if (!this.hasSubscriptionEvidence(root)) missingLayers.push("subscription-commercial-controls-evidence");
        if (!this.hasCustomerOnboardingEvidence(root)) missingLayers.push("customer-onboarding-evidence");

        const blockedExternalDependencies: string[] = [];
        if (contract.includes("Payment-provider activation is an external dependency")) {
            blockedExternalDependencies.push("payment-provider-activation");
        }
        if (contract.includes("Cloud deployment may remain externally blocked")) {
            blockedExternalDependencies.push("production-cloud-resources");
        }

        const commercialProductRuntimeComplete =
            productRuntimeEvidence && identityEvidence && authorizationEvidence &&
            this.hasCanonicalPersistenceEvidence(root) && this.hasObservabilityEvidence(root);

        const canonicalPlatformConstructionComplete =
            this.hasCanonicalDataEvidence(root) && this.hasFinancialIntelligenceEvidence(root) &&
            this.hasExecutiveIntelligenceEvidence(root) && this.hasDecisionIntelligenceEvidence(root) &&
            this.hasOrganizationalExecutionEvidence(root);

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
                commercialProductRuntimeComplete,
                externalProductionDependenciesComplete,
                productComplete
            }
        };
    }

    private hasAssistantEvidence(root: string): boolean {
        return existsSync(join(root, "Backend/HBOS/Engines/AssistantEngine.ts")) &&
            existsSync(join(root, "Backend/HBOS/test/Assistant.test.ts"));
    }

    private hasProductRuntimeEvidence(root: string): boolean {
        const packagePath = join(root, "package.json");
        const runtimePath = join(root, "Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts");
        if (!existsSync(packagePath) || !existsSync(runtimePath)) return false;
        const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as { scripts?: Record<string, string> };
        const scripts = packageJson.scripts ?? {};
        const hasRunnableWebScript = Boolean(scripts.start || scripts.dev || scripts.serve || scripts.preview);
        const webArtifacts = ["web/index.html", "web/app.js", "web/styles.css", "web/manifest.webmanifest"];
        return (hasRunnableWebScript || webArtifacts.every(artifact => existsSync(join(root, artifact)))) &&
            this.hasWebApplicationEvidence(root) &&
            this.hasCanonicalPersistenceEvidence(root);
    }

    private hasIdentityEvidence(root: string): boolean {
        const implementation = join(root, "Backend/HBOS/Engines/UserManagementEngine.ts");
        const test = join(root, "Backend/HBOS/test/UserManagement.test.ts");
        if (!existsSync(implementation) || !existsSync(test)) return false;
        const source = readFileSync(implementation, "utf8");
        const evidence = readFileSync(test, "utf8");
        return ["registerUser", "session", "logout", "invalidate"].every(marker => source.includes(marker) || evidence.includes(marker));
    }

    private hasAuthorizationEvidence(root: string): boolean {
        const implementation = join(root, "Backend/HBOS/Engines/SecurityLayerEngine.ts");
        const test = join(root, "Backend/HBOS/test/SecurityLayerEngine.test.ts");
        if (!existsSync(implementation) || !existsSync(test)) return false;
        const source = readFileSync(implementation, "utf8");
        const evidence = readFileSync(test, "utf8");
        return ["authorize", "role", "permission", "tenant", "cross-tenant"].every(marker => source.includes(marker) || evidence.includes(marker));
    }

    private hasCanonicalDataEvidence(root: string): boolean {
        return existsSync(join(root, "Backend/HBOS/Product/FinancialDataIngestionAdapter.ts")) &&
            existsSync(join(root, "Backend/HBOS/Product/FinancialDataIngestionAdapter.test.ts"));
    }

    private hasFinancialIntelligenceEvidence(root: string): boolean {
        return existsSync(join(root, "Backend/HBOS/Engines/FinancialIntelligenceEngine.ts"));
    }

    private hasExecutiveIntelligenceEvidence(root: string): boolean {
        return existsSync(join(root, "Backend/HBOS/Engines/ExecutiveIntelligenceEngine.ts"));
    }

    private hasDecisionIntelligenceEvidence(root: string): boolean {
        return existsSync(join(root, "Backend/HBOS/Engines/DecisionEngine.ts")) &&
            existsSync(join(root, "Backend/HBOS/test/Decision.test.ts"));
    }

    private hasOrganizationalExecutionEvidence(root: string): boolean {
        return existsSync(join(root, "Backend/HBOS/Engines/ProjectPilotEngine.ts")) &&
            existsSync(join(root, "Backend/HBOS/test/ProjectPilot.test.ts"));
    }

    private hasDashboardReportEvidence(root: string): boolean {
        return existsSync(join(root, "Backend/HBOS/Engines/DashboardEngine.ts")) &&
            existsSync(join(root, "Backend/HBOS/Engines/ReportsEngine.ts"));
    }

    private hasWebApplicationEvidence(root: string): boolean {
        const testPaths = [
            "Backend/HBOS/test/CommercialRuntimeServer.test.ts",
            "Backend/HBOS/test/CommercialRuntimeApplication.test.ts",
            "Backend/HBOS/test/CommercialWebApplication.test.ts"
        ];
        for (const path of testPaths) {
            const file = join(root, path);
            if (!existsSync(file)) continue;
            const test = readFileSync(file, "utf8");
            if (["createCommercialRuntimeServer", "request(", "expect(", "status"].every(marker => test.includes(marker))) return true;
        }
        return false;
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
        ].every((markers, index) => {
            const source = [boundary, adapter, behaviorTest][index];
            return markers.every(marker => source.includes(marker));
        });
    }

    private hasOfflineOnlineEvidence(root: string): boolean {
        return existsSync(join(root, "web")) && existsSync(join(root, "Backend/HBOS/test/CommercialWebApplication.test.ts")) &&
            readFileSync(join(root, "Backend/HBOS/test/CommercialWebApplication.test.ts"), "utf8").includes("offline");
    }

    private hasSecurityPrivacyEvidence(root: string): boolean {
        const candidates = ["Backend/HBOS/Security", "Backend/HBOS/Auth", "Backend/HBOS/Identity"];
        return candidates.some(dir => existsSync(join(root, dir))) && existsSync(join(root, "Docs/SECURITY.md"));
    }

    private hasObservabilityEvidence(root: string): boolean {
        const runtime = join(root, "Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts");
        if (!existsSync(runtime)) return false;
        const source = readFileSync(runtime, "utf8");
        return ["/health", "/api/ready"].every(marker => source.includes(marker));
    }

    private hasDeploymentEvidence(root: string): boolean {
        return existsSync(join(root, "Backend/HBOS/Engines/DeploymentContractEngine.ts")) &&
            existsSync(join(root, "package.json"));
    }

    private hasSubscriptionEvidence(root: string): boolean {
        return existsSync(join(root, "Backend/HBOS/Engines/SubscriptionEngine.ts"));
    }

    private hasCustomerOnboardingEvidence(root: string): boolean {
        return existsSync(join(root, "Backend/HBOS/Engines/OnboardingEngine.ts"));
    }
}
