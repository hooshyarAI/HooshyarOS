import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FinancialEvidenceStore } from "./FinancialEvidenceStore";

describe("FinancialEvidenceStore", () => {
    it("survives process-level restart and preserves financial evidence", async () => {
        const root = await mkdtemp(join(tmpdir(), "hooshyar-evidence-"));
        const databasePath = join(root, "financial.sqlite");
        const payload = {
            source: {
                sourceId: "aapl-q2-2026",
                sourceUri: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000013/aapl-20260328.htm",
                rawPath: "fixture.csv",
                entity: "Apple Inc."
            },
            evidenceHash: "a".repeat(64),
            records: [{ metric: "total_net_sales", period: "2026-03-28", value: 111184, unit: "USD_MILLIONS" }],
            model: {
                sourceId: "aapl-q2-2026",
                entity: "Apple Inc.",
                period: "2026-03-28",
                currency: "USD",
                scale: 1_000_000,
                revenue: 111184,
                expenses: 75299,
                assets: 371082,
                liabilities: 264591
            }
        };

        try {
            const firstProcess = new FinancialEvidenceStore(databasePath);
            firstProcess.save(payload);
            expect(firstProcess.count()).toBe(1);
            firstProcess.close();

            const secondProcess = new FinancialEvidenceStore(databasePath);
            const restored = secondProcess.get("aapl-q2-2026");
            expect(restored).toEqual(payload);
            expect(secondProcess.count()).toBe(1);
            secondProcess.close();
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});
