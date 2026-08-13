import { KaizenImprovementService } from "../Product/KaizenImprovementService";

describe("KaizenImprovementService", () => {
    it("exposes the canonical product boundary", () => {
        const service = new KaizenImprovementService();
        expect(service.capabilityId).toBe("product.kaizen-continuous-improvement");
        expect(service.targetEngine).toBe("Organizational Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new KaizenImprovementService().execute("continue").status).toBe("READY");
        expect(new KaizenImprovementService().execute(" ").status).toBe("BLOCKED");
    });
});
