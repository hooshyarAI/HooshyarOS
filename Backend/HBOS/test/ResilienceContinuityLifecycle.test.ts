import { ResilienceContinuityLifecycle } from "../Product/ResilienceContinuityLifecycle";

describe("ResilienceContinuityLifecycle", () => {
    it("exposes the canonical product boundary", () => {
        const service = new ResilienceContinuityLifecycle();
        expect(service.capabilityId).toBe("product.resilience-continuity-lifecycle");
        expect(service.targetEngine).toBe("Autonomous Operations Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("assesses resilience lifecycle evidence", () => {
        const result = new ResilienceContinuityLifecycle().assess("impact=4;mitigation=5;recovery=3");
        expect(result.status).toBe("READY");
        expect(result.evidence).toBeDefined();
    });

    it("blocks empty evidence input", () => {
        expect(new ResilienceContinuityLifecycle().assess(" ").status).toBe("BLOCKED");
    });
});
