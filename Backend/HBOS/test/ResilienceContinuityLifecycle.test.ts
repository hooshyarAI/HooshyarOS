import { ResilienceContinuityLifecycle } from "../Product/ResilienceContinuityLifecycle";

describe("ResilienceContinuityLifecycle", () => {
    it("exposes the canonical product boundary", () => {
        const service = new ResilienceContinuityLifecycle();
        expect(service.capabilityId).toBe("product.resilience-continuity-lifecycle");
        expect(service.targetEngine).toBe("Autonomous Operations Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new ResilienceContinuityLifecycle().execute("continue").status).toBe("READY");
        expect(new ResilienceContinuityLifecycle().execute(" ").status).toBe("BLOCKED");
    });
});
