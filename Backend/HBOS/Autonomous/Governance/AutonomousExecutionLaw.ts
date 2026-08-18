import { ConstructionStage } from "../../Builder/Autonomous/AutonomousConstructionEngine";

export type AutonomousExecutionOperation = "BUILD" | "REPAIR" | "REBUILD" | "STANDARDIZE" | "COMMERCIALIZE" | "ASSISTANT_SELF_REPAIR";

export interface AutonomousExecutionLawInput {
    operation: AutonomousExecutionOperation;
    capabilityId: string;
    targetEngine: string;
    stage: ConstructionStage;
    tool: string;
    assistantMediated?: boolean;
    platformNative?: boolean;
    verificationPassed?: boolean;
    architectureRules?: string[];
}

export interface AutonomousExecutionLawDecision {
    allowed: boolean;
    reason: string;
    invariants: string[];
}

/**
 * Executable constitutional law for HooshyarOS autonomous construction.
 *
 * Every build, commercialisation, standardisation, repair/rebuild and even
 * assistant self-repair operation must remain inside the platform-native
 * Assistant -> Autonomous Operations Engine -> governed construction toolchain.
 * The law is enforced at the construction control plane, not by documentation.
 */
export class AutonomousExecutionLaw {
    private static readonly REQUIRED_INVARIANTS = [
        "PLATFORM_NATIVE_ONLY",
        "ASSISTANT_MEDIATED",
        "ARCHITECTURE_BOUND",
        "STAGED_EXECUTION",
        "VERIFICATION_BEFORE_FINALIZE",
        "REPAIR_REUSES_GOVERNED_CONSTRUCTION",
        "NO_EXTERNAL_CODING_AGENT"
    ] as const;

    authorize(input: AutonomousExecutionLawInput): AutonomousExecutionLawDecision {
        const invariants = [...AutonomousExecutionLaw.REQUIRED_INVARIANTS];
        const rules = input.architectureRules ?? [];
        const normalizedRules = rules.map(rule => rule.toLowerCase());
        const architectureBound = input.targetEngine.trim().length > 0
            && (normalizedRules.length === 0 || normalizedRules.some(rule =>
                rule.includes("architecture freeze") || rule.includes("canonical") || rule.includes("architecture")
            ));
        const assistantMediated = input.assistantMediated !== false;
        const platformNative = input.platformNative !== false;
        const staged = this.stageAllowed(input.stage, input.tool);
        const externalCodingAgent = process.env.HOOSHYAR_EXTERNAL_CODING_AGENT?.trim();

        if (!platformNative) return this.block("PLATFORM_NATIVE_ONLY", invariants);
        if (!assistantMediated) return this.block("ASSISTANT_MEDIATION_REQUIRED", invariants);
        if (!architectureBound) return this.block("ARCHITECTURE_BOUNDARY_REQUIRED", invariants);
        if (!input.capabilityId.trim()) return this.block("CAPABILITY_ID_REQUIRED", invariants);
        if (!staged.allowed) return this.block(staged.reason, invariants);
        if (input.stage === "FINALIZE" && input.verificationPassed !== true) return this.block("FINALIZE_REQUIRES_PRIOR_VERIFICATION", invariants);
        if (externalCodingAgent) return this.block("EXTERNAL_CODING_AGENT_FORBIDDEN", invariants);

        return { allowed: true, reason: "AUTONOMOUS_EXECUTION_LAW_AUTHORIZED", invariants };
    }

    assert(input: AutonomousExecutionLawInput): void {
        const decision = this.authorize(input);
        if (!decision.allowed) throw new Error(`AUTONOMOUS_EXECUTION_LAW_BLOCKED:${decision.reason}`);
    }

    private stageAllowed(stage: ConstructionStage, tool: string): { allowed: boolean; reason: string } {
        const allowed: Record<ConstructionStage, string[]> = {
            ARCHITECTURE: ["architecture"],
            PLAN: ["architecture", "planner"],
            GENERATE: ["generator", "python"],
            VERIFY: ["python", "verifier", "test"],
            REPAIR: ["python", "repair"],
            FINALIZE: ["git", "finalizer"]
        };
        return allowed[stage].includes(tool)
            ? { allowed: true, reason: "" }
            : { allowed: false, reason: `TOOL_NOT_GOVERNED_FOR_${stage}` };
    }

    private block(reason: string, invariants: string[]): AutonomousExecutionLawDecision {
        return { allowed: false, reason, invariants };
    }
}
