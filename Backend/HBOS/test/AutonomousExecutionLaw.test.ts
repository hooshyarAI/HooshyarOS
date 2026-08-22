import { AutonomousExecutionLaw } from "../Autonomous/Governance/AutonomousExecutionLaw";

describe("Autonomous execution law", () => {
    const law = new AutonomousExecutionLaw();

    const base = {
        operation: "BUILD" as const,
        capabilityId: "platform.customer-value",
        targetEngine: "Autonomous Operations Engine",
        assistantMediated: true,
        platformNative: true,
        architectureRules: ["Architecture Freeze V4", "canonical platform boundary"]
    };

    afterEach(() => {
        delete process.env.HOOSHYAR_EXTERNAL_CODING_AGENT;
    });

    it("authorizes every governed lifecycle operation only through the native tool stages", () => {
        const operations = ["BUILD", "REPAIR", "REBUILD", "STANDARDIZE", "COMMERCIALIZE", "ASSISTANT_SELF_REPAIR"] as const;
        for (const operation of operations) {
            const generated = law.authorize({ ...base, operation, stage: "GENERATE", tool: "python" });
            expect(generated.allowed).toBe(true);
            const verified = law.authorize({ ...base, operation, stage: "VERIFY", tool: "python" });
            expect(verified.allowed).toBe(true);
            const finalized = law.authorize({ ...base, operation, stage: "FINALIZE", tool: "git", verificationPassed: true });
            expect(finalized.allowed).toBe(true);
        }
    });

    it("blocks finalization without independent verification evidence", () => {
        const decision = law.authorize({ ...base, stage: "FINALIZE", tool: "git", verificationPassed: false });
        expect(decision.allowed).toBe(false);
        expect(decision.reason).toBe("FINALIZE_REQUIRES_PRIOR_VERIFICATION");
    });

    it("blocks external coding agents and non-governed tool routing", () => {
        process.env.HOOSHYAR_EXTERNAL_CODING_AGENT = "claude";
        expect(law.authorize({ ...base, stage: "GENERATE", tool: "python" }).reason).toBe("EXTERNAL_CODING_AGENT_FORBIDDEN");

        delete process.env.HOOSHYAR_EXTERNAL_CODING_AGENT;
        expect(law.authorize({ ...base, stage: "GENERATE", tool: "external-agent" }).reason).toBe("TOOL_NOT_GOVERNED_FOR_GENERATE");
        expect(law.authorize({ ...base, stage: "REPAIR", tool: "external-agent", operation: "ASSISTANT_SELF_REPAIR" }).reason).toBe("TOOL_NOT_GOVERNED_FOR_REPAIR");
    });

    it("blocks attempts to bypass the platform-native assistant and architecture boundaries", () => {
        expect(law.authorize({ ...base, stage: "PLAN", tool: "architecture", assistantMediated: false }).reason).toBe("ASSISTANT_MEDIATION_REQUIRED");
        expect(law.authorize({ ...base, stage: "PLAN", tool: "architecture", platformNative: false }).reason).toBe("PLATFORM_NATIVE_ONLY");
        expect(law.authorize({ ...base, stage: "PLAN", tool: "architecture", architectureRules: ["unrelated rule"] }).reason).toBe("ARCHITECTURE_BOUNDARY_REQUIRED");
    });
});
