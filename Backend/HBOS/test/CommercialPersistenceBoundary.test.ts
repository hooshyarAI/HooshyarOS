import { CommercialPersistenceBoundary } from "../Persistence/CommercialPersistenceBoundary";

describe("CommercialPersistenceBoundary", () => {
    it("exposes the canonical product boundary", () => {
        const service = new CommercialPersistenceBoundary();
        expect(service.capabilityId).toBe("product.commercial.persistence-boundary");
        expect(service.targetEngine).toBe("Autonomous Operations Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new CommercialPersistenceBoundary().execute("continue").status).toBe("READY");
        expect(new CommercialPersistenceBoundary().execute(" ").status).toBe("BLOCKED");
    });
});
