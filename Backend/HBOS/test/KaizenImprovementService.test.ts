import { KaizenImprovementService } from "../Product/KaizenImprovementService";

describe("KaizenImprovementService", () => {
    it("exposes the canonical product boundary", () => {
        const service = new KaizenImprovementService();
        expect(service.capabilityId).toBe("product.kaizen-continuous-improvement");
        expect(service.targetEngine).toBe("Organizational Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("assesses the declared product evidence", () => {
        const result = new KaizenImprovementService().assess("quality=4;speed=3;waste=2");
        expect(result.status).toBe("READY");
        expect(result.evidence).toBe(9);
    });

    it("blocks empty evidence input", () => {
        expect(new KaizenImprovementService().assess(" ").status).toBe("BLOCKED");
    });
});
