export interface ArchitectureRequirement {
    capabilityId: string;
    capability: string;
    targetEngine: string;
    dependencies?: string[];
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
            "No duplicate capability owner"
        ];

        reasons.push("requirement is complete");
        reasons.push("architecture rules attached");
        reasons.push("construction plan is deterministic");

        return {
            requirement,
            decision: "approved",
            source: "architecture-brain",
            plan: {
                capabilityId: requirement.capabilityId,
                capability: requirement.capability,
                targetEngine: requirement.targetEngine,
                dependencies,
                architectureRules
            },
            reasons
        };
    }

    static selfTest(): void {
        const result = new ArchitectureDecisionEngine().decide({
            capabilityId: "test-001",
            capability: "architecture-driven construction",
            targetEngine: "Autonomous Operations Engine"
        });

        if (result.decision !== "approved" || !result.plan || result.plan.architectureRules.length < 3) {
            throw new Error("ArchitectureDecisionEngine self-test failed");
        }
    }
}
