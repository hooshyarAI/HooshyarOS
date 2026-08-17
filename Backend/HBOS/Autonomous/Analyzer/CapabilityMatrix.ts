import { CapabilityGateEvaluator, CapabilityEvidence, CapabilityStage } from "./CapabilityGateEvaluator";

export interface CapabilitySnapshot {
    name: string;
    stage: CapabilityStage;
    blockers: string[];
}

const ORDER: CapabilityStage[] = [
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
            if (verified.length === 0) {
                return { name, stage: "DOCUMENTED", blockers: ["No verified evidence supplied"] };
            }

            const current = verified.reduce((highest, item) => {
                return ORDER.indexOf(item.stage) > ORDER.indexOf(highest.stage) ? item : highest;
            });
            const result = this.evaluator.evaluate(current);
            const blockers = result.nextStage === null
                ? result.blockers
                : [...result.blockers, `Next stage requires ${result.nextStage} verification`];

            return { name, stage: result.currentStage, blockers };
        });
    }

    highestPriorityBlocker(capabilities: CapabilitySnapshot[]): CapabilitySnapshot | null {
        return capabilities.find((capability) => capability.blockers.length > 0) ?? null;
    }
}
