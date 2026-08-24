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
        expect(result.layers).toHaveLength(16);
        expect(result.layers.every(layer => !layer.unit && !layer.integration && !layer.application && !layer.acceptance)).toBe(true);
        expect(result.complete).toBe(false);
    });

    it("requires explicit passed-test provenance", () => {
        const root = mkdtempSync(join(tmpdir(), "hooshyar-commercial-audit-"));
        try {
            mkdirSync(join(root, "Docs"), { recursive: true });
            mkdirSync(join(root, "Backend/HBOS/Product"), { recursive: true });
            mkdirSync(join(root, "Backend/HBOS/test"), { recursive: true });
            writeFileSync(join(root, "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md"), "## Commercial completion layers\n## Evidence model\n## Completion states\nPayment-provider activation is an external dependency\nCloud deployment may remain externally blocked");
            writeFileSync(join(root, "Docs/AUDIT_COMMERCIAL_EVIDENCE_MATRIX.md"), "Implementation Unit Integration Application Acceptance");
            writeFileSync(join(root, "Backend/HBOS/Product/FinancialDataIngestionAdapter.ts"), "export class FinancialDataIngestionAdapter {}");
            writeFileSync(join(root, "Backend/HBOS/test/FinancialDataIngestionAdapter.test.ts"), "test('focused', () => expect(true).toBe(true));");
            const audit = new CommercialProductCompletionAudit();
            const withoutResults = audit.audit(root, { verified: true, fullVerify: true, focusedTest: null, testResults: [] });
            expect(withoutResults.layers.find(l => l.layer === "canonical-data")?.unit).toBe(false);
            const withResult = audit.audit(root, { verified: true, fullVerify: true, focusedTest: null, testResults: [{ path: "Backend/HBOS/test/FinancialDataIngestionAdapter.test.ts", passed: true }] });
            expect(withResult.layers.find(l => l.layer === "canonical-data")?.unit).toBe(true);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("does not accept a persistence directory as proof of a persistence boundary", () => {
        const root = mkdtempSync(join(tmpdir(), "hooshyar-commercial-audit-"));
        try {
            mkdirSync(join(root, "Docs"), { recursive: true });
            mkdirSync(join(root, "Backend/HBOS/Persistence"), { recursive: true });
            writeFileSync(join(root, "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md"), "## Commercial completion layers\n## Evidence model\n## Completion states");
            writeFileSync(join(root, "Docs/AUDIT_COMMERCIAL_EVIDENCE_MATRIX.md"), "Implementation Unit Integration Application Acceptance");
            const result = new CommercialProductCompletionAudit().audit(root);
            expect(result.layers.find(l => l.layer === "canonical-data")?.status).toBe("MISSING");
            expect(result.complete).toBe(false);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });
});
