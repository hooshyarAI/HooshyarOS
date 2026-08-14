import { SelfRepairCapability, RepairStrategy } from "../Assistant/Autonomous/SelfRepairCapability";

describe("SelfRepairCapability", () => {
    const strategy = (id: string, ok: boolean): RepairStrategy => ({
        id,
        description: id,
        categories: ["DEPENDENCY"],
        risk: id === "unsafe" ? 8 : 2,
        reversibility: id === "safe" ? 10 : 4,
        architecturalFit: id === "safe" ? 10 : 3,
        externalDependency: false,
        execute: () => ({
            ok,
            evidence: [`executed:${id}`],
            verificationPassed: ok,
            repositoryChanged: ok
        })
    });

    it("classifies, chooses, verifies and remembers the governed autonomous repair", () => {
        const capability = new SelfRepairCapability([strategy("unsafe", true), strategy("safe", true)]);
        const result = capability.repair({ id: "gradle-1", message: "Gradle/JDK dependency failure" });
        expect(result.capabilityId).toBe("assistant.autonomous.self-repair");
        expect(result.classification).toBe("DEPENDENCY");
        expect(result.decision?.strategyId).toBe("safe");
        expect(result.outcome).toBe("FIXED");
        expect(result.evidence).toContain("executed:safe");
        expect(capability.recall("gradle-1")?.outcome).toBe("FIXED");
    });

    it("accepts verified environment repair without requiring a repository commit", () => {
        const environmentStrategy: RepairStrategy = {
            ...strategy("provision", true),
            execute: () => ({ ok: true, evidence: ["environment:provisioned", "verification:passed"], verificationPassed: true, repositoryChanged: false, environmentChanged: true })
        };
        const result = new SelfRepairCapability([environmentStrategy]).repair({ id: "jdk-1", message: "JDK toolchain dependency failure" });
        expect(result.outcome).toBe("FIXED");
    });

    it("produces blocked-with-proof instead of jumping to manual repair", () => {
        const capability = new SelfRepairCapability([strategy("safe", false)]);
        const result = capability.repair({ id: "sdk-1", message: "Android SDK dependency failure" });
        expect(result.outcome).toBe("BLOCKED_WITH_PROOF");
        expect(result.blockedProof).toEqual(expect.arrayContaining([
            "ROOT_CAUSE_CLASS: DEPENDENCY",
            "ATTEMPTS: safe",
            "Every attempt required execution evidence and verification evidence."
        ]));
    });
});
