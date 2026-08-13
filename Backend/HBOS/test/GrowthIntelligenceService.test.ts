import { GrowthIntelligenceService } from "../Product/GrowthIntelligenceService";

describe("GrowthIntelligenceService", () => {
    it("exposes the canonical product boundary", () => {
        const service = new GrowthIntelligenceService();
        expect(service.capabilityId).toBe("product.growth-intelligence");
        expect(service.targetEngine).toBe("Executive Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new GrowthIntelligenceService().execute("continue").status).toBe("READY");
        expect(new GrowthIntelligenceService().execute(" ").status).toBe("BLOCKED");
    });
});
