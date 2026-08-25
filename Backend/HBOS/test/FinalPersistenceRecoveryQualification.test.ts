import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";

describe("Final Persistence / Recovery Qualification", () => {
  let directory: string;
  let databasePath: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "hooshyar-qualification-"));
    databasePath = join(directory, "hooshyar.sqlite");
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  test("persists tenant-scoped state across store restart and rejects cross-tenant reads", async () => {
    const tenantA = { tenantId: "tenant:A" };
    const tenantB = { tenantId: "tenant:B" };

    const first = new SQLitePersistenceStore({ databasePath });
    await first.write(tenantA, "financial-summary", { revenue: 120, profit: 35 });
    await first.write(tenantB, "financial-summary", { revenue: 900, profit: 10 });
    first.close();

    const recovered = new SQLitePersistenceStore({ databasePath });
    await expect(recovered.read(tenantA, "financial-summary")).resolves.toEqual({
      tenantId: "tenant:A",
      key: "financial-summary",
      value: { revenue: 120, profit: 35 },
    });
    await expect(recovered.read(tenantB, "financial-summary")).resolves.toEqual({
      tenantId: "tenant:B",
      key: "financial-summary",
      value: { revenue: 900, profit: 10 },
    });
    await expect(recovered.read(tenantA, "missing")).resolves.toBeNull();
    recovered.close();
  });

  test("fails closed on missing tenant scope and blank keys", async () => {
    const store = new SQLitePersistenceStore({ databasePath });
    await expect(store.write({ tenantId: "" }, "k", { ok: true })).rejects.toThrow("persistence-tenant-required");
    await expect(store.read({ tenantId: "tenant:A" }, " ")).rejects.toThrow("persistence-key-required");
    store.close();
  });
});
