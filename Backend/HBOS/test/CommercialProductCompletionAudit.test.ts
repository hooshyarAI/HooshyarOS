import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CommercialProductCompletionAudit } from "../Autonomous/Runtime/CommercialProductCompletionAudit";

describe("CommercialProductCompletionAudit", () => {
    it("requires the canonical commercial completion contract", () => {
        const audit = new CommercialProductCompletionAudit();
        const result = audit.audit(process.cwd());

        expect(result.contractPresent).toBe(true);
        expect(result.missingLayers).not.toContain("commercial-completion-contract");
    });

    it("recognizes the real canonical persistence boundary instead of treating the product folder as missing", () => {
        const audit = new CommercialProductCompletionAudit();
        const result = audit.audit(process.cwd());

        expect(result.complete).toBe(false);
        expect(result.missingLayers).not.toContain("web-entrypoint");
        expect(result.missingLayers).not.toContain("persistence-boundary");
    });

    it("does not accept a persistence directory as proof of a persistence boundary", () => {
        const root = mkdtempSync(join(tmpdir(), "hooshyar-commercial-audit-"));
        try {
            mkdirSync(join(root, "Docs"), { recursive: true });
            mkdirSync(join(root, "Backend/HBOS/Persistence"), { recursive: true });
            writeFileSync(join(root, "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md"), [
                "## Commercial completion layers",
                "1. Product runtime",
                "2. Identity, users and organizations",
                "4. Data ingestion and canonical data",
                "9. Dashboards and reports",
                "14. Deployment and installation",
                "## Evidence model",
                "## Completion states"
            ].join("\n"));
            writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { start: "node server.js" } }));

            const result = new CommercialProductCompletionAudit().audit(root);

            expect(result.missingLayers).toContain("persistence-boundary");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
