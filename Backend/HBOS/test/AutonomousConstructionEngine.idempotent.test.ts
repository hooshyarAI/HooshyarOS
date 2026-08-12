import { AutonomousConstructionEngine, ConstructionTool } from "../Builder/Autonomous/AutonomousConstructionEngine";

describe("AutonomousConstructionEngine idempotent construction", () => {
    const plan = {
        capabilityId: "product.financial-data-ingestion",
        capability: "ingest and normalize repository-supported financial/accounting data",
        targetEngine: "Financial Intelligence Engine",
        dependencies: ["Knowledge Engine", "Financial Intelligence Engine"],
        architectureRules: ["Architecture Freeze V4"]
    };

    it("accepts an already-implemented deterministic capability after verification", () => {
        const tools: ConstructionTool[] = [
            { name: "architecture", execute: () => ({ ok: true }) },
            {
                name: "generator",
                execute: stage => stage === "GENERATE"
                    ? {
                        ok: false,
                        issue: "AUTONOMOUS_AGENT_NO_REPOSITORY_CHANGE",
                        artifact: {
                            changed: false,
                            exitCode: 0,
                            output: "Already implemented: product.financial-data-ingestion"
                        }
                    }
                    : { ok: true }
            },
            { name: "python", execute: stage => stage === "VERIFY" ? { ok: true } : { ok: true } },
            {
                name: "git",
                execute: stage => stage === "FINALIZE"
                    ? { ok: false, issue: "GIT_NO_REPOSITORY_CHANGE" }
                    : { ok: true }
            }
        ];

        const result = new AutonomousConstructionEngine(tools).build(plan);

        expect(result.ok).toBe(true);
        expect(result.status).toBe("BUILT");
        expect(result.stage).toBe("FINALIZE");
        expect(result.idempotent).toBe(true);
        expect(result.details).toContain("idempotent");
        expect(result.trace).toEqual(["ARCHITECTURE", "PLAN", "GENERATE", "VERIFY", "FINALIZE"]);
    });

    it("does not hide an unexplained generation no-op", () => {
        const tools: ConstructionTool[] = [
            { name: "architecture", execute: () => ({ ok: true }) },
            {
                name: "generator",
                execute: stage => stage === "GENERATE"
                    ? {
                        ok: false,
                        issue: "AUTONOMOUS_AGENT_NO_REPOSITORY_CHANGE",
                        artifact: { changed: false, exitCode: 0, output: "no change" }
                    }
                    : { ok: true }
            },
            { name: "python", execute: () => ({ ok: true }) },
            { name: "git", execute: () => ({ ok: true }) }
        ];

        const result = new AutonomousConstructionEngine(tools).build(plan);

        expect(result.ok).toBe(false);
        expect(result.stage).toBe("GENERATE");
        expect(result.issues).toContain("AUTONOMOUS_AGENT_NO_REPOSITORY_CHANGE");
    });
});
