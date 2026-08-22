export type CapabilityStage =
    | "DOCUMENTED"
    | "IMPLEMENTED"
    | "BEHAVIORALLY_VERIFIED"
    | "INTEGRATION_VERIFIED"
    | "PRODUCTION_VERIFIED"
    | "COMMERCIAL_READY";

const ORDER: CapabilityStage[] = [
    "DOCUMENTED",
    "IMPLEMENTED",
    "BEHAVIORALLY_VERIFIED",
    "INTEGRATION_VERIFIED",
    "PRODUCTION_VERIFIED",
    "COMMERCIAL_READY",
];

export interface CapabilityEvidence {
    capability: string;
    stage: CapabilityStage;
    evidence: readonly string[];
}

export interface CapabilityGateResult {
    capability: string;
    currentStage: CapabilityStage;
    nextStage: CapabilityStage | null;
    blockers: string[];
}

export class CapabilityGateEvaluator {
    evaluate(input: CapabilityEvidence): CapabilityGateResult {
        const blockers = input.evidence.length === 0
            ? ["No evidence supplied"]
            : [];
        const index = ORDER.indexOf(input.stage);
        return {
            capability: input.capability,
            currentStage: input.stage,
            nextStage: index >= 0 && index < ORDER.length - 1 ? ORDER[index + 1] : null,
            blockers,
        };
    }

    canAdvance(input: CapabilityEvidence, target: CapabilityStage): boolean {
        if (input.evidence.length === 0) return false;
        const current = ORDER.indexOf(input.stage);
        const desired = ORDER.indexOf(target);
        return current >= 0 && desired >= 0 && current >= desired;
    }
}
