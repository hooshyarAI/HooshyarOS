import { SelfRepairCapability, RepairStrategy } from "../Assistant/Autonomous/SelfRepairCapability";
import { SelfRepairGovernance } from "../Assistant/Autonomous/SelfRepairGovernance";

describe("SelfRepair external boundary", () => {
    it("preserves boundary evidence so governance can authorize a proven escalation", () => {
        const strategy: RepairStrategy = {
            id: "external-source",
            description: "external source",
            categories: ["DEPENDENCY"],
            risk: 4,
            reversibility: 8,
            architecturalFit: 8,
            externalDependency: true,
            strategyKind: "DEPENDENCY_PROVISIONING",
            execute: () => ({ ok: false, evidence: ["source:404"], verificationPassed: false, repositoryChanged: false, externalBoundary: "External dependency source unavailable" })
        };
        const repairCase = new SelfRepairCapability([strategy]).repair({ id: "external-source", message: "Gradle/JDK dependency source unavailable" });
        expect(repairCase.outcome).toBe("BLOCKED_WITH_PROOF");
        expect(repairCase.blockedProof).toContain("EXTERNAL_BOUNDARY: External dependency source unavailable");
        expect(new SelfRepairGovernance().authorizeManualIntervention(repairCase.blockedProof).allowed).toBe(true);
    });
});
