import { GoalExecutionSchedulingService } from "../Product/GoalExecutionSchedulingService";

describe("GoalExecutionSchedulingService", () => {
    it("exposes the canonical product boundary", () => {
        const service = new GoalExecutionSchedulingService();
        expect(service.capabilityId).toBe("product.goal-kpi-project-task-scheduling");
        expect(service.targetEngine).toBe("Organizational Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("schedules goal and KPI execution evidence", () => {
        const result = new GoalExecutionSchedulingService().schedule("goal->kpi->project->task->owner");
        expect(result.status).toBe("READY");
        expect(result.evidence).toBeDefined();
    });

    it("blocks empty evidence input", () => {
        expect(new GoalExecutionSchedulingService().schedule(" ").status).toBe("BLOCKED");
    });
});
