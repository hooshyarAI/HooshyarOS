import { AssistantHealthMonitor } from "../Assistant/Autonomous/AssistantHealthMonitor";

describe("AssistantHealthMonitor runtime repair integration", () => {
    it("routes customer runtime failures through the governed repair supervisor", () => {
        const monitor = new AssistantHealthMonitor();
        const rollback = jest.fn();
        const result = monitor.repairRuntimeFailure({
            failure: {
                id: "runtime.failure",
                tenantId: "tenant-1",
                component: "API Gateway",
                message: "health failure",
                evidence: ["HEALTH_CHECK_FAILED"],
                architectureBoundary: "API Gateway Engine"
            },
            repair: () => ({ ok: true, changed: true, evidence: ["REPAIR_APPLIED"], rollback }),
            verify: () => true,
            canary: () => true,
            observe: () => undefined
        });
        expect(result.status).toBe("RESUMED");
        expect(rollback).not.toHaveBeenCalled();
    });
});
