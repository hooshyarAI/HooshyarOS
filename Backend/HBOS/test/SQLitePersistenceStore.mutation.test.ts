import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";

describe("SQLitePersistenceStore atomic mutation", () => {
    let persistence: SQLitePersistenceStore;
    beforeEach(() => { persistence = new SQLitePersistenceStore({ databasePath: ":memory:" }); });
    afterEach(() => persistence.close());

    it("atomically mutates a value within one tenant scope", async () => {
        await persistence.write({ tenantId: "tenant-a" }, "counter", { count: 1 });
        await persistence.mutate({ tenantId: "tenant-a" }, "counter", current => {
            const record = current as { count: number };
            return { count: record.count + 1 };
        });
        await expect(persistence.read({ tenantId: "tenant-a" }, "counter")).resolves.toMatchObject({ value: { count: 2 } });
        await expect(persistence.read({ tenantId: "tenant-b" }, "counter")).resolves.toBeNull();
    });

    it("rolls back a failed mutator without changing the stored record", async () => {
        await persistence.write({ tenantId: "tenant-a" }, "counter", { count: 3 });
        await expect(persistence.mutate({ tenantId: "tenant-a" }, "counter", () => {
            throw new Error("mutation-rejected");
        })).rejects.toThrow("mutation-rejected");
        await expect(persistence.read({ tenantId: "tenant-a" }, "counter")).resolves.toMatchObject({ value: { count: 3 } });
    });
});
