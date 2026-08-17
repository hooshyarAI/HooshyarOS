import { CapabilityGateEvaluator, CapabilityEvidence, CapabilityStage } from "./CapabilityGateEvaluator";

export interface CapabilitySnapshot {
    name: string;
    stage: CapabilityStage;
    blockers: string[];
}

export class CapabilityMatrix {
    constructor(private readonly evaluator = new CapabilityGateEvaluator()) {}

    evaluate(capabilities: Array<{ name: string; evidence: CapabilityEvidence[] }>): CapabilitySnapshot[] {
        return capabilities.map(({ name, evidence }) => {
            const result = this.evaluator.evaluate(evidence);
            return { name, stage: result.stage, blockers: result.blockers };
        });
    }

    highestPriorityBlocker(capabilities: CapabilitySnapshot[]): CapabilitySnapshot | null {
        return capabilities.find((capability) => capability.blockers.length > 0) ?? null;
    }
}
