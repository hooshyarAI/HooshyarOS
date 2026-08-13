import { OfflineSyncCoordinator } from "../Product/OfflineSyncCoordinator";

describe("OfflineSyncCoordinator", () => {
    it("exposes the canonical product boundary", () => {
        const service = new OfflineSyncCoordinator();
        expect(service.capabilityId).toBe("product.offline-sync-and-conflict-resolution");
        expect(service.targetEngine).toBe("Autonomous Operations Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("reconciles offline synchronization evidence", () => {
        const result = new OfflineSyncCoordinator().reconcile("local=10;remote=12;conflict=1");
        expect(result.status).toBe("READY");
        expect(result.evidence).toBeDefined();
    });

    it("blocks empty evidence input", () => {
        expect(new OfflineSyncCoordinator().reconcile(" ").status).toBe("BLOCKED");
    });
});
