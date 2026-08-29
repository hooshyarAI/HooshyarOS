import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CommercialCapabilityDiscovery } from "../Autonomous/Runtime/CommercialCapabilityDiscovery";

describe("CommercialCapabilityDiscovery", () => {
    it("detects CSV-only ingestion as an incomplete commercial ingestion surface", () => {
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
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
