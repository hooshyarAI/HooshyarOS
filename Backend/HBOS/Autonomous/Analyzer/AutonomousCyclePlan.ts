export type CycleDecision = "EXECUTE" | "BLOCK";

export interface CyclePlanInput {
    capability: string;
    priority: "P0" | "P1" | "P2" | "P3";
    blockers: string[];
    dependenciesSatisfied: boolean;
    evidenceVerified: boolean;
    requiredTestsDefined: boolean;
}

export interface CyclePlan {
    capability: string;
    decision: CycleDecision;
    reasons: string[];
}

/** Fail-closed planning: priority alone can never authorize execution. */
export function createAutonomousCyclePlan(input: CyclePlanInput): CyclePlan {
    const reasons = [...input.blockers];

    if (!input.dependenciesSatisfied) reasons.push("DEPENDENCIES_NOT_SATISFIED");
    if (!input.evidenceVerified) reasons.push("REQUIRED_EVIDENCE_NOT_VERIFIED");
    if (!input.requiredTestsDefined) reasons.push("REQUIRED_TESTS_NOT_DEFINED");

    return {
        capability: input.capability,
        decision: reasons.length === 0 ? "EXECUTE" : "BLOCK",
        reasons,
    };
}
