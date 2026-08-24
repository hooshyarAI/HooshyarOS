import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CommercialProductCompletionAudit } from "../Autonomous/Runtime/CommercialProductCompletionAudit";

describe("CommercialProductCompletionAudit", () => {
    it("requires the canonical commercial completion contract", () => {
        const result = new CommercialProductCompletionAudit().audit(process.cwd());

        expect(result.contractPresent).toBe(true);
        expect(result.missingLayers).not.toContain("commercial-completion-contract");
    });

    it("reports commercial completion states independently", () => {
        const result = new CommercialProductCompletionAudit().audit(process.cwd());

        expect(result.completionStates).toEqual(expect.objectContaining({
            productComplete: false,
            commercialProductRuntimeComplete: false,
            externalProductionDependenciesComplete: false
        }));
        expect(result.complete).toBe(result.completionStates.productComplete);
        expect(result.blockedExternalDependencies).toEqual(expect.arrayContaining([
            "payment-provider-activation",
            "production-cloud-resources"
        ]));
    });

    it("recognizes the real canonical persistence and web boundaries", () => {
        const result = new CommercialProductCompletionAudit().audit(process.cwd());

        expect(result.missingLayers).not.toContain("web-entrypoint");
        expect(result.missingLayers).not.toContain("web-application-evidence");
        expect(result.missingLayers).not.toContain("persistence-boundary");
        expect(result.missingLayers).toContain("identity-and-session-evidence");
        expect(result.missingLayers).toContain("authorization-and-tenant-evidence");
    });

    it("does not accept a persistence directory as proof of a persistence boundary", () => {
        const root = mkdtempSync(join(tmpdir(), "hooshyar-commercial-audit-"));
        try {
            mkdirSync(join(root, "Docs"), { recursive: true });
            mkdirSync(join(root, "Backend/HBOS/Persistence"), { recursive: true });
            writeFileSync(join(root, "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md"), [
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
            ].join("\n"));
            writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { start: "node server.js" } }));

            const result = new CommercialProductCompletionAudit().audit(root);

            expect(result.missingLayers).toContain("persistence-boundary");
            expect(result.completionStates.productComplete).toBe(false);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
