import { CapabilityGateEvaluator, CapabilityEvidence, CapabilityStage } from "./CapabilityGateEvaluator";

export interface CapabilitySnapshot {
    name: string;
    stage: CapabilityStage;
    blockers: string[];
}

const STAGE_ORDER: CapabilityStage[] = [
    "DOCUMENTED",
    "IMPLEMENTED",
    "BEHAVIORALLY_VERIFIED",
    "INTEGRATION_VERIFIED",
    "PRODUCTION_VERIFIED",
    "COMMERCIAL_READY",
];

export class CapabilityMatrix {
    constructor(private readonly evaluator = new CapabilityGateEvaluator()) {}

    evaluate(capabilities: Array<{ name: string; evidence: CapabilityEvidence[] }>): CapabilitySnapshot[] {
        return capabilities.map(({ name, evidence }) => {
            const verified = evidence.filter((item) => item.evidence.length > 0);
            const current = verified.reduce<CapabilityEvidence | null>((highest, item) => {
                if (!highest) return item;
                return STAGE_ORDER.indexOf(item.stage) > STAGE_ORDER.indexOf(highest.stage) ? item : highest;
            }, null);

            if (!current) {
                return { name, stage: "DOCUMENTED", blockers: ["No evidence supplied"] };
            }

            const result = this.evaluator.evaluate(current);
            return { name, stage: result.currentStage, blockers: result.blockers };
        });
    }

    highestPriorityBlocker(capabilities: CapabilitySnapshot[]): CapabilitySnapshot | null {
        return capabilities.find((capability) => capability.blockers.length > 0) ?? null;
    }
}
