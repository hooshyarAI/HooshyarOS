import { CustomerRuntimeRepairSupervisor } from "../Assistant/Autonomous/CustomerRuntimeRepairSupervisor";

describe("CustomerRuntimeRepairSupervisor", () => {
    const failure = {
        id: "tenant-api-500",
        tenantId: "tenant-1",
        component: "API Gateway",
        message: "runtime failure",
        evidence: ["HTTP_500"],
        architectureBoundary: "API Gateway Engine"
    };

    it("repairs, verifies, canary-checks, audits and resumes automatically", () => {
        const supervisor = new CustomerRuntimeRepairSupervisor();
        const events: any[] = [];
        const rollback = jest.fn();
        const result = supervisor.repair({
            failure,
            repair: () => ({ ok: true, changed: true, evidence: ["PATCH_APPLIED"], rollback }),
            verify: () => true,
            canary: () => true,
            observe: event => events.push(event)
        });
        expect(result.status).toBe("RESUMED");
        expect(result.stage).toBe("RESUME");
        expect(result.evidence).toEqual(expect.arrayContaining(["VERIFICATION_PASSED", "CANARY_PASSED", "AUTOMATIC_RESUME_AUTHORIZED"]));
        expect(events.map(event => event.stage)).toEqual(expect.arrayContaining(["DETECT", "ISOLATE", "DIAGNOSE", "PLAN", "REPAIR", "VERIFY", "CANARY", "RESUME", "LEARN"]));
        expect(rollback).not.toHaveBeenCalled();
    });

    it("rolls back and forbids resume when verification fails", () => {
        const supervisor = new CustomerRuntimeRepairSupervisor();
        const events: any[] = [];
        const rollback = jest.fn();
        const result = supervisor.repair({
            failure,
            repair: () => ({ ok: true, changed: true, evidence: ["PATCH_APPLIED"], rollback }),
            verify: () => false,
            canary: () => true,
            observe: event => events.push(event)
        });
        expect(result.status).toBe("ROLLED_BACK");
        expect(result.evidence).toContain("SERVICE_RESUME_FORBIDDEN");
        expect(rollback).toHaveBeenCalledTimes(1);
        expect(events.find(event => event.stage === "VERIFY")?.status).toBe("FAILED");
        expect(events.find(event => event.stage === "ROLLBACK")?.status).toBe("PASSED");
    });

    it("fails closed when canary fails", () => {
        const supervisor = new CustomerRuntimeRepairSupervisor();
        const rollback = jest.fn();
        const result = supervisor.repair({
            failure,
            repair: () => ({ ok: true, changed: true, evidence: [], rollback }),
            verify: () => true,
            canary: () => false,
            observe: () => undefined
        });
        expect(result.status).toBe("ROLLED_BACK");
        expect(result.evidence).toContain("CANARY_FAILED");
        expect(result.evidence).toContain("SERVICE_RESUME_FORBIDDEN");
        expect(rollback).toHaveBeenCalledTimes(1);
    });
});
