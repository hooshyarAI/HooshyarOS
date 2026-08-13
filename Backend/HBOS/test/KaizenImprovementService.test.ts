import { KaizenImprovementService } from "../Product/KaizenImprovementService";

describe("KaizenImprovementService", () => {
    it("exposes the canonical product boundary", () => {
        const service = new KaizenImprovementService();
        expect(service.capabilityId).toBe("repair-product.kaizen-continuous-improvement");
        expect(service.targetEngine).toBe("Organizational Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("evaluates the declared product evidence", () => {
        const result = new KaizenImprovementService().evaluate("evidence=ready;scope=defined");
        expect(result.status).toBe("READY");
        expect(result.evidence).toBeDefined();
    });

    it("blocks empty evidence input", () => {
        expect(new KaizenImprovementService().evaluate(" ").status).toBe("BLOCKED");
    });
});
