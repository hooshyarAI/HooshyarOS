import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Engine } from "../Core/Engine";

export type CommercialEvidenceStatus = "VERIFIED" | "BLOCKED" | "MISSING";

export interface CommercialEvidenceItem {
    id: string;
    status: CommercialEvidenceStatus;
    evidence: string[];
}

export interface CommercialReadinessAuditResult {
    commercialReady: false;
    items: CommercialEvidenceItem[];
    blockers: string[];
    externalDependencies: string[];
}

/**
 * Evidence-only commercial gate. It can never promote productComplete=true.
 * It reports repository-native proof and explicit external blockers.
 */
export class CommercialReadinessAuditEngine implements Engine {
    name = "CommercialReadinessAuditEngine";

    initialize(): void {}

    health(): boolean {
        return true;
    }

    audit(root = process.cwd()): CommercialReadinessAuditResult {
        const items: CommercialEvidenceItem[] = [];
        const blockers: string[] = [];

        const packagePath = join(root, "package.json");
        const packageJson = existsSync(packagePath)
            ? JSON.parse(readFileSync(packagePath, "utf8")) as { scripts?: Record<string, string> }
            : {};
        const runtimeEvidence = [
            "package.json",
            "jest.config.js",
            "Backend/HBOS/Engines/APIGatewayEngine.ts"
        ];
        const runtimeMissing = runtimeEvidence.filter((path) => !existsSync(join(root, path)));
        if (!packageJson.scripts?.start) runtimeMissing.push("package.json: scripts.start");
        items.push({ id: "product-runtime", status: runtimeMissing.length ? "MISSING" : "VERIFIED", evidence: runtimeMissing.length ? runtimeMissing : runtimeEvidence });
        if (runtimeMissing.length) blockers.push("product-runtime");

        const identityEvidence = [
            "Backend/HBOS/Security/UserCredentialStore.ts",
            "Backend/HBOS/Security/AuthenticationService.ts",
            "Backend/HBOS/Security/DurableSessionStore.ts",
            "Backend/HBOS/Security/AuthorizationService.ts",
            "Backend/HBOS/Security/DurableAuthorizationStore.ts"
        ];
        const identityMissing = identityEvidence.filter((path) => !existsSync(join(root, path)));
        items.push({ id: "identity-security", status: identityMissing.length ? "MISSING" : "VERIFIED", evidence: identityMissing.length ? identityMissing : identityEvidence });
        if (identityMissing.length) blockers.push("identity-security");

        const ingestionEvidence = ["Backend/HBOS/Engines/FinancialDataIngestionEngine.ts"];
        const ingestionMissing = ingestionEvidence.filter((path) => !existsSync(join(root, path)));
        items.push({ id: "financial-ingestion", status: ingestionMissing.length ? "MISSING" : "VERIFIED", evidence: ingestionMissing.length ? ingestionMissing : ingestionEvidence });
        if (ingestionMissing.length) blockers.push("financial-ingestion");

        const uiEvidence = ["Frontend", "Web", "web", "App.tsx", "index.html"];
        const uiPresent = uiEvidence.filter((path) => existsSync(join(root, path)));
        items.push({ id: "web-ui", status: uiPresent.length ? "VERIFIED" : "MISSING", evidence: uiPresent.length ? uiPresent : ["responsive web/PWA application surface"] });
        if (!uiPresent.length) blockers.push("web-ui");

        const tenantEvidence = [
            "Backend/HBOS/Engines/OrganizationModelEngine.ts",
            "Backend/HBOS/Security/DurableAuthorizationStore.ts"
        ];
        const tenantMissing = tenantEvidence.filter((path) => !existsSync(join(root, path)));
        items.push({ id: "tenant-isolation", status: tenantMissing.length ? "MISSING" : "BLOCKED", evidence: tenantMissing.length ? tenantMissing : ["organization model exists; cross-tenant isolation proof is still required"] });
        blockers.push("tenant-isolation-verification");

        const observabilityEvidence = ["Backend/HBOS/Security/SecurityAuditStore.ts"];
        const observabilityMissing = observabilityEvidence.filter((path) => !existsSync(join(root, path)));
        items.push({ id: "audit-observability", status: observabilityMissing.length ? "MISSING" : "BLOCKED", evidence: observabilityMissing.length ? observabilityMissing : ["security audit exists; runtime health/structured operational telemetry still requires verification"] });
        blockers.push("operational-observability-verification");

        items.push({ id: "deployment", status: "BLOCKED", evidence: ["repository deployment contract exists; runnable product start/health/recovery evidence is not yet proven"] });
        blockers.push("deployment-verification");

        items.push({ id: "commercial-controls", status: "BLOCKED", evidence: ["subscription/entitlement/payment activation requires product scope and external evidence"] });
        blockers.push("commercial-controls");

        return {
            commercialReady: false,
            items,
            blockers,
            externalDependencies: ["production infrastructure", "customer acceptance", "payment-provider activation", "external credentials"]
        };
    }
}
