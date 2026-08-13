import { StrategicTransformationOKRService } from "../Product/StrategicTransformationOKRService";

describe("StrategicTransformationOKRService", () => {
    it("exposes the canonical product boundary", () => {
        const service = new StrategicTransformationOKRService();
        expect(service.capabilityId).toBe("product.goal-okr-transformation");
        expect(service.targetEngine).toBe("Organizational Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("transforms strategic goals into execution evidence", () => {
        const result = new StrategicTransformationOKRService().transform(
            "vision->mission->okr->project->task",
        );
        expect(result.status).toBe("READY");
        expect(result.evidence).toEqual([
            "vision",
            "mission",
            "okr",
            "project",
            "task",
        ]);
    });

    it("blocks incomplete transformation evidence", () => {
        expect(new StrategicTransformationOKRService().transform("vision->mission").status).toBe("BLOCKED");
        expect(new StrategicTransformationOKRService().transform(" ").status).toBe("BLOCKED");
    });
});
