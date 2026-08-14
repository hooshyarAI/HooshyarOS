import { SelfRepairCapability, RepairStrategy } from "../Assistant/Autonomous/SelfRepairCapability";

describe("SelfRepairCapability proportional planning", () => {
    const strategy = (id: string, kind: RepairStrategy["strategyKind"]): RepairStrategy => ({
        id,
        description: id,
        categories: ["DEPENDENCY"],
        risk: 2,
        reversibility: 10,
        architecturalFit: 10,
        externalDependency: false,
        strategyKind: kind,
        execute: () => ({ ok: true, evidence: [`executed:${id}`], verificationPassed: true, repositoryChanged: true })
    });

    it("uses proportional HIGH-depth planning for toolchain failures and prefers the planned strategy", () => {
        const result = new SelfRepairCapability([
            strategy("dependency", "DEPENDENCY_PROVISIONING"),
            strategy("focused", "FOCUSED_CANONICAL_REPAIR")
        ]).repair({ id: "android-toolchain", message: "Gradle/JDK Android toolchain dependency failure" });

        expect(result.repairDepth).toBe("HIGH");
        expect(result.repairPlan.strategy).toBe("FOCUSED_CANONICAL_REPAIR");
        expect(result.decision?.strategyId).toBe("focused");
        expect(result.outcome).toBe("FIXED");
    });

    it("records depth and selected strategy in blocked-with-proof evidence", () => {
        const failing: RepairStrategy = {
            ...strategy("focused", "FOCUSED_CANONICAL_REPAIR"),
            execute: () => ({ ok: false, evidence: ["verification:failed"], verificationPassed: false, repositoryChanged: false })
        };
        const result = new SelfRepairCapability([failing]).repair({ id: "sdk-boundary", message: "Android SDK dependency failure" });

        expect(result.outcome).toBe("BLOCKED_WITH_PROOF");
        expect(result.blockedProof).toEqual(expect.arrayContaining([
            "REPAIR_DEPTH: HIGH",
            "SELECTED_STRATEGY: FOCUSED_CANONICAL_REPAIR",
            "ATTEMPTS: focused"
        ]));
    });
});
