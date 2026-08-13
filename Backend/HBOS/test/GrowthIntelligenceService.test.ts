import { GrowthIntelligenceService } from "../Product/GrowthIntelligenceService";

describe("GrowthIntelligenceService", () => {
    it("exposes the canonical product boundary", () => {
        const service = new GrowthIntelligenceService();
        expect(service.capabilityId).toBe("product.growth-intelligence");
        expect(service.targetEngine).toBe("Executive Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("calculates growth intelligence evidence", () => {
        const result = new GrowthIntelligenceService().calculate("growth=5;capacity=3;constraint=2");
        expect(result.status).toBe("READY");
        expect(result.evidence).toBeDefined();
    });

    it("blocks empty evidence input", () => {
        expect(new GrowthIntelligenceService().calculate(" ").status).toBe("BLOCKED");
    });
});
