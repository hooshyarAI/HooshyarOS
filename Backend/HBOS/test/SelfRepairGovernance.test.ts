import { SelfRepairGovernance } from "../Assistant/Autonomous/SelfRepairGovernance";
import { RepairStrategy } from "../Assistant/Autonomous/SelfRepairCapability";

describe("SelfRepairGovernance", () => {
    const safe: RepairStrategy = {
        id: "safe",
        description: "safe",
        categories: ["BUILD"],
        risk: 2,
        reversibility: 10,
        architecturalFit: 10,
        externalDependency: false,
        execute: () => ({ ok: true, evidence: [], verificationPassed: true, repositoryChanged: true })
    };

    it("permits a governed repair inside the architecture boundary", () => {
        const decision = new SelfRepairGovernance().authorizeRepair({ id: "f", message: "build", architectureBoundary: "owned" }, safe);
        expect(decision.allowed).toBe(true);
    });

    it("rejects manual intervention until autonomous blockage is proven", () => {
        const governance = new SelfRepairGovernance();
        expect(governance.authorizeManualIntervention(["ROOT_CAUSE_CLASS: BUILD", "ATTEMPTS: safe"]).allowed).toBe(false);
        expect(governance.authorizeManualIntervention(["ROOT_CAUSE_CLASS: BUILD", "ATTEMPTS: safe", "EXTERNAL_BOUNDARY: missing toolchain source"]).allowed).toBe(true);
    });
});
