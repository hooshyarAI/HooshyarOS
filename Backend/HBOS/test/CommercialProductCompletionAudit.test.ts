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

    it("does not confuse canonical persistence and web evidence with commercial completion", () => {
        const result = new CommercialProductCompletionAudit().audit(process.cwd());
        expect(result.complete).toBe(false);
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
                "1. Product runtime", "2. Identity, users and organizations", "3. Multi-tenancy and authorization",
                "4. Data ingestion and canonical data", "5. Financial intelligence", "6. Executive and managerial intelligence",
                "7. Decision intelligence and Expert Choice", "8. Organizational execution", "9. Dashboards and reports",
                "10. Web and mobile", "11. Offline/online behavior", "12. Security and privacy",
                "13. Observability and operations", "14. Deployment and installation", "## Evidence model", "## Completion states"
            ].join("\n"));
            writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { start: "node server.js" } }));
            const result = new CommercialProductCompletionAudit().audit(root);
            expect(result.missingLayers).toContain("persistence-boundary");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("does not treat UserManagementEngine existence as commercial identity evidence", () => {
        const root = mkdtempSync(join(tmpdir(), "hooshyar-commercial-identity-"));
        try {
            mkdirSync(join(root, "Docs"), { recursive: true });
            mkdirSync(join(root, "Backend/HBOS/Engines"), { recursive: true });
            writeFileSync(join(root, "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md"), "## Commercial completion layers\n1. Product runtime\n2. Identity, users and organizations\n3. Multi-tenancy and authorization\n4. Data ingestion and canonical data\n5. Financial intelligence\n6. Executive and managerial intelligence\n7. Decision intelligence and Expert Choice\n8. Organizational execution\n9. Dashboards and reports\n10. Web and mobile\n11. Offline/online behavior\n12. Security and privacy\n13. Observability and operations\n14. Deployment and installation\n## Evidence model\n## Completion states");
            writeFileSync(join(root, "Backend/HBOS/Engines/UserManagementEngine.ts"), "export class UserManagementEngine { registerUser(username: string) { return username; } }");
            writeFileSync(join(root, "Backend/HBOS/Engines/SecurityLayerEngine.ts"), "export class SecurityLayerEngine { authorize(subject: string) { return subject; } }");
            writeFileSync(join(root, "Backend/HBOS/Engines/OrganizationModelEngine.ts"), "export class OrganizationModelEngine {}");
            const result = new CommercialProductCompletionAudit().audit(root);
            expect(result.missingLayers).toContain("identity-and-session-evidence");
            expect(result.missingLayers).toContain("authorization-and-tenant-evidence");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
