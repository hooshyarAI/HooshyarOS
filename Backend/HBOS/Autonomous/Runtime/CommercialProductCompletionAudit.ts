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
        if (!existsSync(contractFile)) return { complete: false, contractPresent: false, missingLayers: ["commercial-completion-contract"], blockedExternalDependencies: [] };
        const contract = readFileSync(contractFile, "utf8");
        const requiredMarkers = [
            "## Commercial completion layers", "1. Product runtime", "2. Identity, users and organizations", "3. Multi-tenancy and authorization",
            "4. Data ingestion and canonical data", "5. Financial intelligence", "6. Executive and managerial intelligence",
            "7. Decision intelligence and Expert Choice", "8. Organizational execution", "9. Dashboards and reports", "10. Web and mobile",
            "11. Offline/online behavior", "12. Security and privacy", "13. Observability and operations", "14. Deployment and installation",
            "## Evidence model", "## Completion states"
        ];
        const missingLayers = requiredMarkers.filter(marker => !contract.includes(marker)).map(marker => `contract-marker:${marker}`);
        const requiredArtifacts: Array<[string, string]> = [
            ["api-gateway", "Backend/HBOS/Engines/APIGatewayEngine.ts"], ["user-management", "Backend/HBOS/Engines/UserManagementEngine.ts"],
            ["organization-model", "Backend/HBOS/Engines/OrganizationModelEngine.ts"], ["dashboard-engine", "Backend/HBOS/Engines/DashboardEngine.ts"],
            ["reports-engine", "Backend/HBOS/Engines/ReportsEngine.ts"], ["deployment-contract", "Backend/HBOS/Engines/DeploymentContractEngine.ts"]
        ];
        for (const [layer, artifact] of requiredArtifacts) if (!existsSync(join(root, artifact))) missingLayers.push(layer);
        const packagePath = join(root, "package.json");
        if (!existsSync(packagePath)) missingLayers.push("web-entrypoint");
        else {
            const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as { scripts?: Record<string, string> };
            const scripts = packageJson.scripts ?? {};
            const hasRunnableWebScript = Boolean(scripts.start || scripts.dev || scripts.serve || scripts.preview);
            const webArtifacts = ["web/index.html", "web/app.js", "web/styles.css", "web/manifest.webmanifest", "Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts"];
            if (!hasRunnableWebScript && !webArtifacts.every(artifact => existsSync(join(root, artifact)))) missingLayers.push("web-entrypoint");
        }
        if (!this.hasWebApplicationEvidence(root)) missingLayers.push("web-application-evidence");
        if (!this.hasCanonicalPersistenceEvidence(root)) missingLayers.push("persistence-boundary");
        if (!this.hasIdentityEvidence(root)) missingLayers.push("identity-and-session-evidence");
        if (!this.hasAuthorizationEvidence(root)) missingLayers.push("authorization-and-tenant-evidence");
        const blockedExternalDependencies: string[] = [];
        if (contract.includes("Payment-provider activation is an external dependency")) blockedExternalDependencies.push("payment-provider-activation");
        if (contract.includes("Cloud deployment may remain externally blocked")) blockedExternalDependencies.push("production-cloud-resources");
        return { complete: missingLayers.length === 0, contractPresent: true, missingLayers, blockedExternalDependencies };
    }

    private hasWebApplicationEvidence(root: string): boolean {
        const testPaths = ["Backend/HBOS/test/CommercialRuntimeServer.test.ts", "Backend/HBOS/test/CommercialRuntimeApplication.test.ts", "Backend/HBOS/test/CommercialWebApplication.test.ts"];
        for (const path of testPaths) {
            const file = join(root, path);
            if (!existsSync(file)) continue;
            const test = readFileSync(file, "utf8");
            if ((test.includes("CommercialRuntimeServer") || test.includes("createCommercialRuntimeServer")) && ["request(", "expect(", "status"].every(marker => test.includes(marker))) return true;
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
        const boundaryContract = ["interface TenantScope", "interface PersistenceRecord", "interface PersistenceStore", "read(scope: TenantScope", "write(scope: TenantScope", "persistence-tenant-scope-required"].every(marker => boundary.includes(marker));
        const durableAdapter = ["implements PersistenceStore", "DatabaseSync", "CREATE TABLE IF NOT EXISTS persistence_records", "tenant_id TEXT NOT NULL", "read(scope: TenantScope", "write(scope: TenantScope", "WHERE tenant_id = ? AND key = ?"].every(marker => adapter.includes(marker));
        const behavioralEvidence = ["SQLitePersistenceStore", "survives database restart", "database.close()", "new SQLitePersistenceStore({ databasePath })", "tenant-scoped"].every(marker => behaviorTest.includes(marker));
        return boundaryContract && durableAdapter && behavioralEvidence;
    }

    private hasIdentityEvidence(root: string): boolean {
        const implementationPaths = ["Backend/HBOS/Engines/UserManagementEngine.ts", "Backend/HBOS/Engines/SecurityLayerEngine.ts"];
        const behaviorTestPaths = ["Backend/HBOS/test/CommercialIdentityApplication.test.ts", "Backend/HBOS/test/CommercialAuthentication.test.ts"];
        if (!implementationPaths.every(path => existsSync(join(root, path)))) return false;
        const implementation = implementationPaths.map(path => readFileSync(join(root, path), "utf8")).join("\n").toLowerCase();
        const hasLifecycleSurface = ["authenticate(", "logout(", "invalidate", "recoverpassword", "password"].every(marker => implementation.includes(marker));
        const hasBehaviorTest = behaviorTestPaths.some(path => {
            const absolutePath = join(root, path);
            if (!existsSync(absolutePath)) return false;
            const source = readFileSync(absolutePath, "utf8").toLowerCase();
            return ["authenticate", "logout", "expect(", "session"].every(marker => source.includes(marker));
        });
        return hasLifecycleSurface && hasBehaviorTest;
    }

    private hasAuthorizationEvidence(root: string): boolean {
        const securityPath = join(root, "Backend/HBOS/Engines/SecurityLayerEngine.ts");
        const organizationPath = join(root, "Backend/HBOS/Engines/OrganizationModelEngine.ts");
        const behaviorTestPaths = ["Backend/HBOS/test/CommercialAuthorizationApplication.test.ts", "Backend/HBOS/test/CommercialTenantIsolation.test.ts"];
        if (!existsSync(securityPath) || !existsSync(organizationPath)) return false;
        const implementation = (readFileSync(securityPath, "utf8") + "\n" + readFileSync(organizationPath, "utf8")).toLowerCase();
        const hasScopeAndPermissionSurface = ["role", "permission", "organization", "tenant"].every(marker => implementation.includes(marker));
        const hasBehaviorTest = behaviorTestPaths.some(path => {
            const absolutePath = join(root, path);
            if (!existsSync(absolutePath)) return false;
            const source = readFileSync(absolutePath, "utf8").toLowerCase();
            return ["cross-tenant", "unauthorized", "expect(", "tenant"].every(marker => source.includes(marker));
        });
        return hasScopeAndPermissionSurface && hasBehaviorTest;
    }
}
