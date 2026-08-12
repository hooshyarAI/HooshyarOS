import { ExecutiveIntelligenceWorkbench } from "../Product/ExecutiveIntelligenceWorkbench";

describe("ExecutiveIntelligenceWorkbench", () => {
    it("exposes the canonical product boundary", () => {
        const service = new ExecutiveIntelligenceWorkbench();
        expect(service.capabilityId).toBe("product.executive-intelligence-workbench");
        expect(service.targetEngine).toBe("Executive Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new ExecutiveIntelligenceWorkbench().execute("continue").status).toBe("READY");
        expect(new ExecutiveIntelligenceWorkbench().execute(" ").status).toBe("BLOCKED");
    });
});
