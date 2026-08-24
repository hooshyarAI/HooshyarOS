import { DecisionWorkbench } from "../Product/DecisionWorkbench";

describe("DecisionWorkbench", () => {
    it("exposes the canonical product boundary", () => {
        const service = new DecisionWorkbench();
        expect(service.capabilityId).toBe("repair-product.decision-workbench");
        expect(service.targetEngine).toBe("Decision Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new DecisionWorkbench().execute("continue").status).toBe("READY");
        expect(new DecisionWorkbench().execute(" ").status).toBe("BLOCKED");
    });
});
