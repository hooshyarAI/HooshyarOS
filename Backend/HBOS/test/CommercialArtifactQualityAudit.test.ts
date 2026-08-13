import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CommercialArtifactQualityAudit } from "../Autonomous/Runtime/CommercialArtifactQualityAudit";

describe("CommercialArtifactQualityAudit", () => {
    it("rejects the minimal READY/BLOCKED product scaffold pattern", () => {
        const root = mkdtempSync(join(process.cwd(), ".tmp-quality-audit-"));
        try {
            mkdirSync(join(root, "Backend/HBOS/Product"), { recursive: true });
            mkdirSync(join(root, "Backend/HBOS/test"), { recursive: true });
            writeFileSync(
                join(root, "Backend/HBOS/Product/FakeProduct.ts"),
                `export interface ProductCapabilityResult { status: "READY" | "BLOCKED"; }\nexport class FakeProduct { initialize(): { status: "READY" } { return { status: "READY" }; } execute(input: string): ProductCapabilityResult { return { status: input && input.trim() ? "READY" : "BLOCKED" }; } }`,
                "utf8"
            );
            writeFileSync(
                join(root, "Backend/HBOS/test/FakeProduct.test.ts"),
                `describe("FakeProduct", () => { it("contract", () => { const value = new FakeProduct(); expect(value.initialize().status).toBe("READY"); expect(value.execute("continue").status).toBe("READY"); expect(value.execute(" ").status).toBe("BLOCKED"); }); });`,
                "utf8"
            );

            const result = new CommercialArtifactQualityAudit().auditCapability(
                root,
                "product.fake",
                "Backend/HBOS/Product/FakeProduct.ts",
                "Backend/HBOS/test/FakeProduct.test.ts"
            );

            expect(result.complete).toBe(false);
            expect(result.failures).toContain("product.fake:trivial-scaffold");
            expect(result.failures).toContain("product.fake:contract-only-test");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("accepts a capability with meaningful data transformation and behavioral assertions", () => {
        const root = mkdtempSync(join(process.cwd(), ".tmp-quality-audit-good-"));
        try {
            mkdirSync(join(root, "Backend/HBOS/Product"), { recursive: true });
            mkdirSync(join(root, "Backend/HBOS/test"), { recursive: true });
            writeFileSync(
                join(root, "Backend/HBOS/Product/FinancialProduct.ts"),
                `export class FinancialProduct { normalize(records: Record<string, number>[]) { return records.map(record => ({ ...record, margin: record.profit / record.revenue })); } }`,
                "utf8"
            );
            writeFileSync(
                join(root, "Backend/HBOS/test/FinancialProduct.test.ts"),
                `describe("FinancialProduct", () => { it("calculates margin from evidence", () => { const result = new FinancialProduct().normalize([{ profit: 25, revenue: 100 }]); expect(result[0].margin).toBeCloseTo(0.25); }); });`,
                "utf8"
            );

            const result = new CommercialArtifactQualityAudit().auditCapability(
                root,
                "product.financial",
                "Backend/HBOS/Product/FinancialProduct.ts",
                "Backend/HBOS/test/FinancialProduct.test.ts"
            );

            expect(result.complete).toBe(true);
            expect(result.failures).toEqual([]);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
