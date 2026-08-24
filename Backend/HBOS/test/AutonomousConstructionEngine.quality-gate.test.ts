import { AutonomousConstructionEngine, ConstructionTool } from "../Builder/Autonomous/AutonomousConstructionEngine";

type VerifyArtifact = {
    testsPassed?: boolean;
    jestVerified?: boolean;
    builderTestsRun?: boolean;
    builderTestsVerified?: boolean;
    focusedTest?: string | null;
    fullVerify?: boolean;
    behavioralEvidenceVerified?: boolean;
    integrationVerified?: boolean;
    cleanRepository?: boolean;
};

function buildTools(verify: VerifyArtifact, generateChanged = true, generateEvidence = true): ConstructionTool[] {
    return [
        {
            name: "architecture",
            execute: stage => ({
                ok: true,
                artifact: stage === "ARCHITECTURE" ? { approved: true } : undefined
            })
        },
        {
            name: "python",
            execute: stage => ({
                ok: true,
                artifact: stage === "GENERATE"
                    ? {
                        changed: generateChanged,
                        unexpectedPaths: generateEvidence ? [] : ["unexpected/path.ts"],
                        missingRequiredArtifacts: generateEvidence ? [] : ["missing.ts"],
                        allDeclaredArtifactsReady: generateEvidence
                    }
                    : stage === "VERIFY" ? verify : undefined
            })
        },
        {
            name: "git",
            execute: stage => ({
                ok: true,
                artifact: stage === "FINALIZE" ? { committed: true, pushed: true, clean: true } : undefined
            })
        }
    ];
}

const plan = {
    capabilityId: "quality-gate-test",
    capability: "quality-gate-test capability",
    targetEngine: "Autonomous Operations Engine",
    dependencies: [],
    architectureRules: ["Architecture Freeze V4"]
};

describe("AutonomousConstructionEngine quality gate", () => {
    test("blocks finalize when behavioral evidence is missing", () => {
        const engine = new AutonomousConstructionEngine(buildTools({
            testsPassed: true,
            behavioralEvidenceVerified: false,
            integrationVerified: true,
            cleanRepository: true
        }));

        const result = engine.build(plan);

        expect(result.ok).toBe(false);
        expect(result.stage).toBe("VERIFY");
        expect(result.issues).toContain("QUALITY_BEHAVIOR_UNVERIFIED");
    });

    test("blocks finalize when integration evidence is missing", () => {
        const engine = new AutonomousConstructionEngine(buildTools({
            testsPassed: true,
            behavioralEvidenceVerified: true,
            integrationVerified: false,
            cleanRepository: true
        }));

        const result = engine.build(plan);

        expect(result.ok).toBe(false);
        expect(result.stage).toBe("VERIFY");
        expect(result.issues).toContain("QUALITY_INTEGRATION_UNVERIFIED");
    });

    test("blocks finalize when generator reports no repository change for a non-idempotent mission", () => {
        const engine = new AutonomousConstructionEngine(buildTools({
            testsPassed: true,
            behavioralEvidenceVerified: true,
            integrationVerified: true,
            cleanRepository: true
        }, false));

        const result = engine.build(plan);

        expect(result.ok).toBe(false);
        expect(result.stage).toBe("VERIFY");
        expect(result.issues).toContain("QUALITY_IMPLEMENTATION_UNVERIFIED");
    });

    test("blocks finalize when runtime verification passes but generated-artifact evidence is unsafe", () => {
        const engine = new AutonomousConstructionEngine(buildTools({
            jestVerified: true,
            focusedTest: null,
            fullVerify: false,
            builderTestsRun: false,
            builderTestsVerified: false
        }, true, false));

        const result = engine.build(plan);

        expect(result.ok).toBe(false);
        expect(result.stage).toBe("VERIFY");
        expect(result.issues).toContain("QUALITY_REPOSITORY_UNVERIFIED");
    });

    test("accepts runtime verification evidence when Jest and declared artifact boundaries agree", () => {
        const engine = new AutonomousConstructionEngine(buildTools({
            jestVerified: true,
            focusedTest: null,
            fullVerify: false,
            builderTestsRun: false,
            builderTestsVerified: false
        }));

        const result = engine.build(plan);

        expect(result.ok).toBe(true);
        expect(result.stage).toBe("FINALIZE");
        expect(result.trace).toContain("FINALIZE");
    });

    test("permits finalize only when all explicit quality evidence is present", () => {
        const engine = new AutonomousConstructionEngine(buildTools({
            testsPassed: true,
            behavioralEvidenceVerified: true,
            integrationVerified: true,
            cleanRepository: true
        }));

        const result = engine.build(plan);

        expect(result.ok).toBe(true);
        expect(result.stage).toBe("FINALIZE");
        expect(result.trace).toContain("FINALIZE");
    });
});
