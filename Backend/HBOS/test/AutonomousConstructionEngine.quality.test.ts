import { AutonomousConstructionEngine, ConstructionTool } from "../Builder/Autonomous/AutonomousConstructionEngine";

const plan = {
    capabilityId: "quality-test",
    capability: "quality-controlled construction",
    targetEngine: "Autonomous Operations Engine",
    dependencies: [],
    architectureRules: ["Architecture Freeze V4"]
};

describe("AutonomousConstructionEngine quality gate integration", () => {
    it("blocks a green test without behavioral or integration evidence", () => {
        const tools: ConstructionTool[] = [
            { name: "architecture", execute: () => ({ ok: true, artifact: { approved: true } }) },
            { name: "python", execute: stage => stage === "GENERATE"
                ? { ok: true, artifact: { changed: true } }
                : { ok: true, artifact: { testsPassed: true, jestVerified: true, cleanRepository: true, behavioralEvidenceVerified: false, integrationVerified: false } } },
            { name: "git", execute: () => ({ ok: true, artifact: { clean: true } }) }
        ];
        const result = new AutonomousConstructionEngine(tools).build(plan);
        expect(result.ok).toBe(false);
        expect(result.stage).toBe("VERIFY");
        expect(result.issues).toContain("QUALITY_BEHAVIOR_UNVERIFIED");
        expect(result.issues).toContain("QUALITY_INTEGRATION_UNVERIFIED");
    });

    it("reaches finalize only after complete quality evidence", () => {
        const tools: ConstructionTool[] = [
            { name: "architecture", execute: () => ({ ok: true, artifact: { approved: true } }) },
            { name: "python", execute: stage => stage === "GENERATE"
                ? { ok: true, artifact: { changed: true } }
                : { ok: true, artifact: { testsPassed: true, jestVerified: true, cleanRepository: true, behavioralEvidenceVerified: true, integrationVerified: true } } },
            { name: "git", execute: stage => stage === "FINALIZE" ? { ok: true, artifact: { clean: true } } : { ok: true } }
        ];
        const result = new AutonomousConstructionEngine(tools).build(plan);
        expect(result.ok).toBe(true);
        expect(result.stage).toBe("FINALIZE");
        expect(result.trace).toEqual(["ARCHITECTURE", "PLAN", "GENERATE", "VERIFY", "FINALIZE"]);
    });
});
