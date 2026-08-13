import { GoalExecutionSchedulingService } from "../Product/GoalExecutionSchedulingService";

describe("GoalExecutionSchedulingService", () => {
    it("exposes the canonical product boundary", () => {
        const service = new GoalExecutionSchedulingService();
        expect(service.capabilityId).toBe("product.goal-kpi-project-task-scheduling");
        expect(service.targetEngine).toBe("Organizational Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new GoalExecutionSchedulingService().execute("continue").status).toBe("READY");
        expect(new GoalExecutionSchedulingService().execute(" ").status).toBe("BLOCKED");
    });
});
