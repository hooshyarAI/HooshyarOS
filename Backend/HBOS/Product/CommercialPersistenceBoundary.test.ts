import { CommercialPersistenceBoundary, PersistenceStore } from "./CommercialPersistenceBoundary";

describe("CommercialPersistenceBoundary", () => {
  const data = new Map<string, unknown>();
  const store: PersistenceStore = {
    async read(scope, key) {
      const value = data.get(`${scope.tenantId}:${key}`);
      return value === undefined ? null : { tenantId: scope.tenantId, key, value };
    },
    async write(scope, key, value) {
      data.set(`${scope.tenantId}:${key}`, value);
      return { tenantId: scope.tenantId, key, value };
    },
  };

  it("requires a tenant scope", async () => {
    const boundary = new CommercialPersistenceBoundary(store);
    await expect(boundary.read({ tenantId: "" }, "x")).rejects.toThrow("persistence-tenant-scope-required");
  });

  it("isolates reads and writes by tenant", async () => {
    const boundary = new CommercialPersistenceBoundary(store);
    await boundary.write({ tenantId: "tenant-a" }, "k", "A");
    await boundary.write({ tenantId: "tenant-b" }, "k", "B");

    await expect(boundary.read({ tenantId: "tenant-a" }, "k")).resolves.toEqual({ tenantId: "tenant-a", key: "k", value: "A" });
    await expect(boundary.read({ tenantId: "tenant-b" }, "k")).resolves.toEqual({ tenantId: "tenant-b", key: "k", value: "B" });
  });
});
