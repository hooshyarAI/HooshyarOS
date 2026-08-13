import { OfflineSyncCoordinator } from "../Product/OfflineSyncCoordinator";

describe("OfflineSyncCoordinator", () => {
    it("exposes the canonical product boundary", () => {
        const service = new OfflineSyncCoordinator();
        expect(service.capabilityId).toBe("product.offline-sync-and-conflict-resolution");
        expect(service.targetEngine).toBe("Autonomous Operations Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new OfflineSyncCoordinator().execute("continue").status).toBe("READY");
        expect(new OfflineSyncCoordinator().execute(" ").status).toBe("BLOCKED");
    });
});
