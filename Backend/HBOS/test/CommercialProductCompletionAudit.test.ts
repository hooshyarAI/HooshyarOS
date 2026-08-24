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

    it("does not treat existing test files as executed evidence", () => {
        const result = new CommercialProductCompletionAudit().audit(process.cwd());

        expect(result.layers.length).toBe(16);
        expect(result.layers.every(layer => layer.unit === false || layer.integration === false || layer.application === false || layer.acceptance === false)).toBe(true);
        expect(result.complete).toBe(false);
    });

    it("accepts a focused passing verification only for the executed test", () => {
        const root = mkdtempSync(join(tmpdir(), "hooshyar-commercial-audit-"));
        try {
            mkdirSync(join(root, "Docs"), { recursive: true });
            mkdirSync(join(root, "Backend/HBOS/Product"), { recursive: true });
            mkdirSync(join(root, "Backend/HBOS/test"), { recursive: true });
            writeFileSync(join(root, "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md"), ["## Commercial completion layers", "## Evidence model", "## Completion states"].join("\n"));
            writeFileSync(join(root, "Docs/AUDIT_COMMERCIAL_EVIDENCE_MATRIX.md"), "Implementation Unit Integration Application Acceptance");
            writeFileSync(join(root, "Backend/HBOS/Product/FinancialDataIngestionAdapter.ts"), "export class FinancialDataIngestionAdapter {}");
            writeFileSync(join(root, "Backend/HBOS/test/FinancialDataIngestionAdapter.test.ts"), "test('focused', () => expect(true).toBe(true));");

            const result = new CommercialProductCompletionAudit().audit(root, {
                verified: true,
                fullVerify: false,
                focusedTest: "Backend/HBOS/test/FinancialDataIngestionAdapter.test.ts"
            });

            const data = result.layers.find(layer => layer.layer === "canonical-data");
            expect(data?.implementation).toBe(true);
            expect(data?.unit).toBe(true);
            expect(data?.integration).toBe(false);
            expect(result.complete).toBe(false);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("does not accept a persistence directory as proof of a persistence boundary", () => {
        const root = mkdtempSync(join(tmpdir(), "hooshyar-commercial-audit-"));
        try {
            mkdirSync(join(root, "Docs"), { recursive: true });
            mkdirSync(join(root, "Backend/HBOS/Persistence"), { recursive: true });
            writeFileSync(join(root, "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md"), [
                "## Commercial completion layers",
                "## Evidence model",
                "## Completion states"
            ].join("\n"));
            writeFileSync(join(root, "Docs/AUDIT_COMMERCIAL_EVIDENCE_MATRIX.md"), "Implementation Unit Integration Application Acceptance");
            writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { start: "node server.js" } }));

            const result = new CommercialProductCompletionAudit().audit(root);

            expect(result.layers.find(layer => layer.layer === "canonical-data")?.status).toBe("MISSING");
            expect(result.complete).toBe(false);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
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
});
