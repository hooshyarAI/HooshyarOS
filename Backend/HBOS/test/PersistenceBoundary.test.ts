import { PersistenceBoundary, PersistenceRecord } from "../Persistence/PersistenceBoundary";

describe("PersistenceBoundary", () => {
    it("defines tenant-aware durable record operations without binding HBOS to a provider", async () => {
        const boundary: PersistenceBoundary = {
            save: async (_record: PersistenceRecord) => undefined,
            get: async (_id: string) => null,
            delete: async (_id: string) => undefined
        };

        await expect(boundary.save({
            id: "record-1",
            type: "financial-evidence",
            payload: { amount: 100 },
            tenantId: "tenant-1",
            createdAt: new Date().toISOString()
        })).resolves.toBeUndefined();
        await expect(boundary.get("record-1")).resolves.toBeNull();
        await expect(boundary.delete("record-1")).resolves.toBeUndefined();
    });
});
