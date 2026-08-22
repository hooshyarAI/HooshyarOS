import { RiskAssessment } from "./RiskAssessment";

export type RiskAction = "BLOCK" | "FIX_BEFORE_NEXT_WAVE" | "PLAN" | "MONITOR";

export interface RiskPriority {
    id: string;
    action: RiskAction;
    executionAllowed: boolean;
}

export class RiskPriorityEngine {
    prioritize(assessment: RiskAssessment): RiskPriority {
        switch (assessment.level) {
            case "CRITICAL":
                return { id: assessment.id, action: "BLOCK", executionAllowed: false };
            case "HIGH":
                return { id: assessment.id, action: "FIX_BEFORE_NEXT_WAVE", executionAllowed: false };
            case "MEDIUM":
                return { id: assessment.id, action: "PLAN", executionAllowed: true };
            case "LOW":
                return { id: assessment.id, action: "MONITOR", executionAllowed: true };
            default:
                return { id: assessment.id, action: "BLOCK", executionAllowed: false };
        }
    }
}
