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
