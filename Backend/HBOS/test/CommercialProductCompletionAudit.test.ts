import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CommercialProductCompletionAudit } from "../Autonomous/Runtime/CommercialProductCompletionAudit";

const CANONICAL_MATRIX = `# Commercial Evidence Matrix

Canonical audit model for \`CommercialProductCompletionAudit\`.

A commercial layer is VERIFIED only when repository-native evidence reaches the required evidence level defined by \`Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md\`.

| Layer | Minimum evidence gate |
|---|---|
| Product runtime | Application + persistence + health/readiness behavior |
| Identity | Application authentication/session behavior + security event evidence |
| Multi-tenancy/authorization | Integration/application tenant isolation + cross-tenant rejection |
| Data ingestion | Integration + application ingestion path + provenance/fail-closed evidence |
| Financial intelligence | Integration + application/representative financial analysis evidence |
| Executive intelligence | Application KPI/target/alert/drill-down evidence |
| Decision intelligence | Application scenario/criteria/recommendation + approval evidence |
| Organizational execution | Application decision-to-workflow evidence |
| Dashboards/reports | Application rendering/interaction + report/export evidence |
| Web/mobile | Responsive application evidence; native only if frozen scope requires it |
| Offline/online | Sync/conflict application evidence when offline is in scope |
| Security/privacy | Security behavior + audit logging + recovery/policy evidence |
| Observability | Product runtime health/readiness/errors/telemetry/audit evidence |
| Deployment | Reproducible install/build/start/health evidence |
| Subscription | Plan/entitlement/tenant-state/limits/provider-boundary evidence when in scope |
| Onboarding | End-to-end representative user-value path |

Presence of an engine, directory, documentation file, or unit test alone is never sufficient for commercial completion.`;

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
            writeFileSync(join(root, "Docs/AUDIT_COMMERCIAL_EVIDENCE_MATRIX.md"), CANONICAL_MATRIX);
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
            writeFileSync(join(root, "Docs/AUDIT_COMMERCIAL_EVIDENCE_MATRIX.md"), CANONICAL_MATRIX);
            const result = new CommercialProductCompletionAudit().audit(root);
            expect(result.layers.find(l => l.layer === "canonical-data")?.status).toBe("MISSING");
            expect(result.complete).toBe(false);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });
});