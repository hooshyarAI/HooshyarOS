import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { CommercialCapabilityDiscovery } from "../Autonomous/Runtime/CommercialCapabilityDiscovery";

describe("CommercialCapabilityDiscovery", () => {
    it("detects CSV-only ingestion as an incomplete commercial ingestion surface and preserves product ownership", () => {
        const root = mkdtempSync(join(tmpdir(), "hooshyar-commercial-discovery-"));
        try {
            mkdirSync(join(root, "web"), { recursive: true });
            writeFileSync(join(root, "web", "index.html"), '<input id="csv-file" type="file" accept=".csv,text/csv" />', "utf8");
            writeFileSync(join(root, "web", "app.js"), 'fetch("/api/analyze")', "utf8");
            writeFileSync(join(root, "web", "styles.css"), ".shell{display:grid}", "utf8");

            const result = new CommercialCapabilityDiscovery().discover(root);

            expect(result).not.toBeNull();
            expect(result?.capabilityId).toBe("commercial.ingestion.multiformat");
            expect(result?.targetEngine).toBe("Financial Data Ingestion Adapter");
            expect(result?.requiredPaths.map(file => relative(root, file))).toEqual([
                "Backend/HBOS/Product/FinancialDataIngestionAdapter.ts",
                "Backend/HBOS/test/FinancialDataIngestionAdapter.test.ts",
                "Docs/Product/FinancialDataIngestionAdapter.md"
            ]);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
