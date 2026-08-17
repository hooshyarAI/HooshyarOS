import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CsvFinancialIngestion } from "./CsvFinancialIngestion";
import { DurableFinancialEvidenceStore } from "./DurableFinancialEvidenceStore";

describe("DurableFinancialEvidenceStore", () => {
    it("persists evidence, isolates tenants, and recovers after restart", async () => {
        const root = await mkdtemp(join(tmpdir(), "hooshyar-financial-evidence-"));
        const databasePath = join(root, "financial.sqlite");
        const records = new CsvFinancialIngestion().ingest(
            "accountCode,accountName,transactionDate,debit,credit,description\n1000,Cash,2026-08-17,100,0,Opening",
            "tenant-a",
            "source-1"
        );
        let store = new DurableFinancialEvidenceStore(databasePath);
        const evidence = store.save(records[0]);
        expect(store.get("tenant-a", evidence.id)?.payload).toEqual(records[0]);
        expect(store.get("tenant-b", evidence.id)).toBeNull();
        expect(store.listByTenant("tenant-b")).toEqual([]);
        const hash = evidence.payloadHash;
        store.close();

        store = new DurableFinancialEvidenceStore(databasePath);
        const recovered = store.get("tenant-a", evidence.id);
        expect(recovered?.payloadHash).toBe(hash);
        expect(recovered?.payload).toEqual(records[0]);
        expect(store.get("tenant-b", evidence.id)).toBeNull();
        store.close();
        await rm(root, { recursive: true, force: true });
    });

    it("rolls back the whole batch when a later record cannot be serialized", async () => {
        const root = await mkdtemp(join(tmpdir(), "hooshyar-financial-evidence-rollback-"));
        const store = new DurableFinancialEvidenceStore(join(root, "financial.sqlite"));
        const valid = new CsvFinancialIngestion().ingest(
            "accountCode,accountName,transactionDate,debit,credit,description\n1000,Cash,2026-08-17,100,0,Opening",
            "tenant-a",
            "source-rollback"
        )[0];
        const circular = { ...valid, rowNumber: 2 } as Record<string, unknown>;
        circular.self = circular;

        expect(() => store.saveMany([valid, circular as never])).toThrow();
        expect(store.listByTenant("tenant-a")).toEqual([]);
        store.close();
        await rm(root, { recursive: true, force: true });
    });
});
