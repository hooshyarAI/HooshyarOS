import { StrategicTransformationOKRService } from "../Product/StrategicTransformationOKRService";

describe("StrategicTransformationOKRService", () => {
    it("exposes the canonical product boundary", () => {
        const service = new StrategicTransformationOKRService();
        expect(service.capabilityId).toBe("product.goal-okr-transformation");
        expect(service.targetEngine).toBe("Organizational Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new StrategicTransformationOKRService().execute("continue").status).toBe("READY");
        expect(new StrategicTransformationOKRService().execute(" ").status).toBe("BLOCKED");
    });
});
