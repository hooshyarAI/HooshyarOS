import { AssistantHealthMonitor } from "../Assistant/Autonomous/AssistantHealthMonitor";

describe("AssistantHealthMonitor runtime repair", () => {
    it("routes a customer failure to the governed autonomous repair supervisor", () => {
        const monitor = new AssistantHealthMonitor();
        const rollback = jest.fn();
        const events: any[] = [];
        const result = monitor.repairRuntimeFailure({
            failure: {
                id: "runtime-1",
                tenantId: "tenant-1",
                component: "Commercial Runtime",
                message: "service failure",
                evidence: ["HEALTH_CHECK_FAILED"],
                architectureBoundary: "Commercial Runtime"
            },
            repair: () => ({ ok: true, changed: true, evidence: ["REPAIR_APPLIED"], rollback }),
            verify: () => true,
            canary: () => true,
            observe: event => events.push(event)
        });
        expect(result.status).toBe("RESUMED");
        expect(events.some(event => event.stage === "CANARY" && event.status === "PASSED")).toBe(true);
        expect(rollback).not.toHaveBeenCalled();
    });
});
