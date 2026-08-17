import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FinancialDataIngestionEngine } from "./FinancialDataIngestionEngine";

describe("FinancialDataIngestionEngine real-data vertical slice", () => {
    it("ingests captured SEC financial evidence through canonicalization, persistence and intelligence", async () => {
        const evidenceRoot = await mkdtemp(join(tmpdir(), "hooshyar-financial-"));
        const engine = new FinancialDataIngestionEngine();
        const source = {
            sourceId: "aapl-q2-2026",
            sourceUri: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000013/aapl-20260328.htm",
            rawPath: join(process.cwd(), "Backend/HBOS/Fixtures/financial/aapl-q2-2026.csv")
        };

        try {
            const result = await engine.ingest(source, evidenceRoot);
            const evidence = JSON.parse(await readFile(result.evidencePath, "utf8"));
            const canonical = JSON.parse(await readFile(result.canonicalPath, "utf8"));

            expect(result.status).toBe("READY");
            expect(result.model).toMatchObject({
                entity: "Apple Inc.",
                period: "2026-03-28",
                revenue: 111184,
                expenses: 75299,
                assets: 371082,
                liabilities: 264591
            });
            expect(result.intelligence.profit).toBe(35885);
            expect(result.intelligence.status).toBe("READY");
            expect(result.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
            expect(evidence.source.sourceUri).toBe(source.sourceUri);
            expect(canonical.evidenceHash).toBe(result.evidenceHash);
        } finally {
            await rm(evidenceRoot, { recursive: true, force: true });
        }
    });
});
