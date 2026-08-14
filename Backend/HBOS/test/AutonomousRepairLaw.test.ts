import { AUTONOMOUS_REPAIR_LAW } from "../Assistant/Autonomous/AutonomousRepairLaw";
import { SelfRepairGovernance } from "../Assistant/Autonomous/SelfRepairGovernance";

describe("AutonomousRepairLaw", () => {
    it("requires autonomous-first governed repair", () => {
        expect(AUTONOMOUS_REPAIR_LAW.autonomousFirst).toBe(true);
        expect(AUTONOMOUS_REPAIR_LAW.architectureBoundaryNonBypassable).toBe(true);
        expect(AUTONOMOUS_REPAIR_LAW.verificationMandatory).toBe(true);
        expect(AUTONOMOUS_REPAIR_LAW.optimizationRequired).toBe(true);
        expect(AUTONOMOUS_REPAIR_LAW.manualInterventionLastResort).toBe(true);
        expect(AUTONOMOUS_REPAIR_LAW.externalEscalationRequiresProof).toBe(true);
    });

    it("makes customer runtime repair autonomous-first and safety-gated", () => {
        expect(AUTONOMOUS_REPAIR_LAW.customerRuntimeRepairRequired).toBe(true);
        expect(AUTONOMOUS_REPAIR_LAW.tenantIsolationNonBypassable).toBe(true);
        expect(AUTONOMOUS_REPAIR_LAW.dataIntegrityNonBypassable).toBe(true);
        expect(AUTONOMOUS_REPAIR_LAW.securityControlsNonBypassable).toBe(true);
        expect(AUTONOMOUS_REPAIR_LAW.rollbackMandatory).toBe(true);
        expect(AUTONOMOUS_REPAIR_LAW.canaryVerificationMandatory).toBe(true);
        expect(AUTONOMOUS_REPAIR_LAW.observabilityMandatory).toBe(true);
        expect(AUTONOMOUS_REPAIR_LAW.durableRepairAuditMandatory).toBe(true);
        expect(AUTONOMOUS_REPAIR_LAW.automaticResumeOnlyAfterVerification).toBe(true);

        const governance = new SelfRepairGovernance();
        expect(governance.authorizeCustomerRuntimeRepair({
            tenantId: "tenant-a",
            failureId: "runtime-001",
            affectsCustomerData: true,
            securityBoundaryAtRisk: false,
            rollbackAvailable: true,
            canaryVerificationAvailable: true,
            observabilityAvailable: true
        })).toEqual({
            allowed: true,
            reason: "CUSTOMER_RUNTIME_REPAIR_WITHIN_GOVERNED_BOUNDARY"
        });
    });

    it("fails closed when a customer runtime repair lacks its safety envelope", () => {
        const governance = new SelfRepairGovernance();
        expect(governance.authorizeCustomerRuntimeRepair({
            tenantId: "tenant-a",
            failureId: "runtime-002",
            affectsCustomerData: true,
            securityBoundaryAtRisk: false,
            rollbackAvailable: false,
            canaryVerificationAvailable: true,
            observabilityAvailable: true
        })).toEqual({
            allowed: false,
            reason: "CUSTOMER_RUNTIME_ROLLBACK_REQUIRED"
        });
    });

    it("forbids manual intervention without durable autonomous-boundary proof", () => {
        const governance = new SelfRepairGovernance();
        expect(governance.authorizeManualIntervention(undefined)).toEqual({
            allowed: false,
            reason: "AUTONOMOUS_SELF_REPAIR_NOT_PROVEN_BLOCKED"
        });
        expect(governance.authorizeManualIntervention([
            "ROOT_CAUSE_CLASS: TEST",
            "ATTEMPTS: FOCUSED_CANONICAL_REPAIR"
        ]).allowed).toBe(false);
    });

    it("permits escalation only after an explicit external boundary is proven", () => {
        const governance = new SelfRepairGovernance();
        expect(governance.authorizeManualIntervention([
            "ROOT_CAUSE_CLASS: DEPENDENCY",
            "ATTEMPTS: FOCUSED_CANONICAL_REPAIR, DEPENDENCY_PROVISIONING",
            "EXTERNAL_BOUNDARY: required credential is outside autonomous authority"
        ])).toEqual({
            allowed: true,
            reason: "AUTONOMOUS_BOUNDARY_PROVEN"
        });
    });
});
