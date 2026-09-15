import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CommercialProductCompletionAudit } from "../Autonomous/Runtime/CommercialProductCompletionAudit";

const CONTRACT_MARKERS = [
    "# HooshyarOS Commercial Product Completion Contract",
    "## Commercial completion layers",
    "1. Product runtime",
    "2. Identity, users and organizations",
    "4. Data ingestion and canonical data",
    "9. Dashboards and reports",
    "14. Deployment and installation",
    "## Evidence model",
    "## Completion states"
].join("\n");

const COMMIT = "a".repeat(40);
const OTHER_COMMIT = "b".repeat(40);

function writeFile(root: string, relative: string, content: string): void {
    const path = join(root, relative);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, content, "utf8");
}

function seedCompleteRoot(): string {
    const root = mkdtempSync(join(tmpdir(), "hooshyar-commercial-audit-"));
    writeFile(root, "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md", CONTRACT_MARKERS);
    for (const engine of ["APIGatewayEngine", "UserManagementEngine", "OrganizationModelEngine", "DashboardEngine", "ReportsEngine", "DeploymentContractEngine"]) {
        writeFile(root, `Backend/HBOS/Engines/${engine}.ts`, `export class ${engine} {}\n`);
    }
    writeFile(root, "package.json", JSON.stringify({ name: "tmp-product", scripts: { start: "node index.js" } }));
    mkdirSync(join(root, "Backend", "HBOS", "Persistence"), { recursive: true });
    mkdirSync(join(root, "Backend", "HBOS", "Auth"), { recursive: true });
    writeFile(root, ".hooshyar/web-acceptance-success.json", JSON.stringify({
        type: "WEB_PRODUCT_ACCEPTANCE_SUCCESS",
        version: 7,
        status: "PASS",
        commit: COMMIT,
        acceptance: ["root", "health", "session", "tenant", "ingestion", "analysis"]
    }));
    writeFile(root, ".hooshyar/security-acceptance-success.json", JSON.stringify({
        type: "SECURITY_TENANT_ACCEPTANCE_SUCCESS",
        version: 4,
        status: "PASS",
        commit: COMMIT,
        acceptance: ["unauthenticated-dashboard-denied", "tenant-a-data-isolated", "tenant-b-data-isolated"]
    }));
    return root;
}

describe("CommercialProductCompletionAudit", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it("requires the canonical commercial completion contract", () => {
        const result = new CommercialProductCompletionAudit().audit(process.cwd());
        expect(result.contractPresent).toBe(true);
        expect(result.missingLayers).not.toContain("commercial-completion-contract");
    });

    it("requires a canonical runnable web product entrypoint", () => {
        const result = new CommercialProductCompletionAudit().audit(process.cwd());
        expect(result.missingLayers).not.toContain("web-entrypoint");
    });

    it("reports completion only when commit-bound application and acceptance evidence is valid", () => {
        const root = seedCompleteRoot();
        process.env.HOOSHYAR_PAYMENT_PROVIDER_ACTIVATED = "1";
        process.env.HOOSHYAR_PRODUCTION_CLOUD_READY = "1";
        try {
            const result = new CommercialProductCompletionAudit().audit(root, { currentCommit: COMMIT });
            expect(result.missingLayers).toEqual([]);
            expect(result.blockedExternalDependencies).toEqual([]);
            expect(result.applicationEvidence.passed).toBe(true);
            expect(result.applicationEvidence.fresh).toBe(true);
            expect(result.acceptanceEvidence.passed).toBe(true);
            expect(result.acceptanceEvidence.fresh).toBe(true);
            expect(result.evidenceGaps).toEqual([]);
            expect(result.complete).toBe(true);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("fails closed when the application/acceptance evidence is stale for the trusted checkpoint", () => {
        const root = seedCompleteRoot();
        process.env.HOOSHYAR_PAYMENT_PROVIDER_ACTIVATED = "1";
        process.env.HOOSHYAR_PRODUCTION_CLOUD_READY = "1";
        try {
            const result = new CommercialProductCompletionAudit().audit(root, { currentCommit: OTHER_COMMIT });
            expect(result.complete).toBe(false);
            expect(result.evidenceGaps).toEqual(expect.arrayContaining([
                "application-evidence-stale",
                "acceptance-evidence-stale"
            ]));
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("fails closed when application/acceptance evidence is missing", () => {
        const root = seedCompleteRoot();
        process.env.HOOSHYAR_PAYMENT_PROVIDER_ACTIVATED = "1";
        process.env.HOOSHYAR_PRODUCTION_CLOUD_READY = "1";
        try {
            rmSync(join(root, ".hooshyar", "web-acceptance-success.json"), { force: true });
            const result = new CommercialProductCompletionAudit().audit(root, { currentCommit: COMMIT });
            expect(result.complete).toBe(false);
            expect(result.evidenceGaps).toEqual(expect.arrayContaining([
                "application-evidence-missing",
                "acceptance-evidence-missing"
            ]));
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("never reports complete while an external production dependency is blocked", () => {
        const root = seedCompleteRoot();
        delete process.env.HOOSHYAR_PAYMENT_PROVIDER_ACTIVATED;
        delete process.env.HOOSHYAR_PRODUCTION_CLOUD_READY;
        try {
            const result = new CommercialProductCompletionAudit().audit(root, { currentCommit: COMMIT });
            expect(result.complete).toBe(false);
            expect(result.blockedExternalDependencies).toEqual(expect.arrayContaining([
                "payment-provider-activation",
                "production-cloud-resources"
            ]));
            expect(result.evidenceGaps).toContain("external-dependency-blocked");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
