import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { LocalTenantPersistenceStore, TenantPersistenceService } from "../Product/TenantPersistenceService";

describe("TenantPersistenceService", () => {
    let root: string;
    let service: TenantPersistenceService;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "hooshyar-tenant-"));
        service = new TenantPersistenceService(new LocalTenantPersistenceStore(root));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it("persists tenant data durably and increments version", () => {
        const first = service.save("tenant-a", "org-a", { revenue: 100 });
        const second = service.save("tenant-a", "org-a", { revenue: 120 });

        expect(first.version).toBe(1);
        expect(second.version).toBe(2);
        expect(service.loadForTenant("tenant-a", "org-a")).toEqual(expect.objectContaining({
            tenantId: "tenant-a",
            organizationId: "org-a",
            version: 2,
            data: { revenue: 120 }
        }));
    });

    it("enforces organization isolation for tenant data", () => {
        service.save("tenant-a", "org-a", { secret: "A" });

        expect(() => service.loadForTenant("tenant-a", "org-b")).toThrow("TENANT_ISOLATION_VIOLATION");
    });
});
