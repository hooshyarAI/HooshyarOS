import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FinancialDataIngestionEngine } from "./FinancialDataIngestionEngine";
import { FinancialEvidenceStore } from "./FinancialEvidenceStore";

describe("Financial ingestion persistence integration", () => {
    it("preserves the canonical financial result across a store restart", async () => {
        const root = await mkdtemp(join(tmpdir(), "hooshyar-financial-integration-"));
        const databasePath = join(root, "financial.sqlite");
        const evidenceRoot = join(root, "evidence");
        const source = {
            sourceId: "aapl-q2-2026",
            sourceUri: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000013/aapl-20260328.htm",
            rawPath: join(process.cwd(), "Backend/HBOS/Fixtures/financial/aapl-q2-2026.csv"),
            entity: "Apple Inc."
        };

        try {
            const firstStore = new FinancialEvidenceStore(databasePath);
            const firstResult = await new FinancialDataIngestionEngine(undefined, firstStore).ingest(source, evidenceRoot);
            firstStore.close();

            const secondStore = new FinancialEvidenceStore(databasePath);
            const restored = secondStore.get(source.sourceId);

            expect(restored).not.toBeNull();
            expect(restored?.evidenceHash).toBe(firstResult.evidenceHash);
            expect(restored?.model).toEqual(firstResult.model);
            expect(restored?.source.sourceUri).toBe(source.sourceUri);
            expect(secondStore.count()).toBe(1);
            secondStore.close();
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});
