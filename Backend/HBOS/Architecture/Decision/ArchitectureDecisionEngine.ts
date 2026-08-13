export interface ArchitectureRequirement {
    capabilityId: string;
    capability: string;
    targetEngine: string;
    dependencies?: string[];
    requiredPaths?: string[];
    repairOf?: string;
}

export interface ArchitectureDecision {
    requirement: ArchitectureRequirement;
    decision: "approved" | "blocked";
    source: "architecture-brain";
    plan?: {
        capabilityId: string;
        capability: string;
        targetEngine: string;
        dependencies: string[];
        architectureRules: string[];
        requiredPaths: string[];
        repairOf?: string;
    };
    reasons: string[];
}

export class ArchitectureDecisionEngine {
    decide(requirement: ArchitectureRequirement): ArchitectureDecision {
        const reasons: string[] = [];

        if (!requirement.capabilityId || !requirement.capability || !requirement.targetEngine) {
            return {
                requirement,
                decision: "blocked",
                source: "architecture-brain",
                reasons: ["INCOMPLETE_ARCHITECTURE_REQUIREMENT"]
            };
        }

        const dependencies = requirement.dependencies || [];
        const architectureRules = [
            "Architecture Freeze V4",
            "One Capability = One Engine",
            "Engine must be observable",
            "Engine must be testable",
            "Engine must be recoverable",
            "No duplicate capability owner",
            "Generated artifacts must stay inside the declared capability boundary"
        ];

        reasons.push("requirement is complete");
        reasons.push("architecture rules attached");
        reasons.push("construction plan is deterministic");
        reasons.push(requirement.requiredPaths?.length ? "capability artifact boundary attached" : "no explicit artifact boundary declared");
        if (requirement.repairOf) reasons.push("repair scope remains attached to the canonical parent capability");

        return {
            requirement,
            decision: "approved",
            source: "architecture-brain",
            plan: {
                capabilityId: requirement.capabilityId,
                capability: requirement.capability,
                targetEngine: requirement.targetEngine,
                dependencies,
                architectureRules,
                requiredPaths: requirement.requiredPaths || [],
                ...(requirement.repairOf ? { repairOf: requirement.repairOf } : {})
            },
            reasons
        };
    }

    static selfTest(): void {
        const result = new ArchitectureDecisionEngine().decide({
            capabilityId: "repair-test-001",
            repairOf: "product.test-001",
            capability: "repair architecture-driven construction",
            targetEngine: "Autonomous Operations Engine"
        });

        if (result.decision !== "approved" || !result.plan || result.plan.architectureRules.length < 3 || result.plan.repairOf !== "product.test-001") {
            throw new Error("ArchitectureDecisionEngine self-test failed");
        }
    }
}