import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQLitePersistenceStore } from "./SQLitePersistenceStore";

describe("SQLitePersistenceStore", () => {
  let directory: string;
  let databasePath: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "hooshyar-persistence-"));
    databasePath = join(directory, "hooshyar.sqlite");
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("persists tenant-scoped values across store instances", async () => {
    const first = new SQLitePersistenceStore({ databasePath });
    await first.write({ tenantId: "tenant-a" }, "kpi", { revenue: 42 });
    first.close();

    const second = new SQLitePersistenceStore({ databasePath });
    await expect(second.read({ tenantId: "tenant-a" }, "kpi")).resolves.toEqual({
      tenantId: "tenant-a",
      key: "kpi",
      value: { revenue: 42 },
    });
    second.close();
  });

  it("does not cross tenant boundaries for the same key", async () => {
    const store = new SQLitePersistenceStore({ databasePath });
    await store.write({ tenantId: "tenant-a" }, "kpi", { revenue: 42 });

    await expect(store.read({ tenantId: "tenant-b" }, "kpi")).resolves.toBeNull();
    store.close();
  });

  it("rejects an empty persistence key", async () => {
    const store = new SQLitePersistenceStore({ databasePath });

    await expect(store.write({ tenantId: "tenant-a" }, "", 1)).rejects.toThrow(
      "persistence-key-required"
    );

    store.close();
  });
});
