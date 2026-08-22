import { RiskAssessment } from "./RiskAssessment";

export type RiskAction = "BLOCK" | "FIX_BEFORE_NEXT_WAVE" | "PLAN" | "MONITOR" | "COLLECT_EVIDENCE";

export interface RiskPriority {
    id: string;
    action: RiskAction;
}

export function prioritizeRisk(assessment: RiskAssessment): RiskPriority {
    switch (assessment.level) {
        case "CRITICAL":
            return { id: assessment.id, action: "BLOCK" };
        case "HIGH":
            return { id: assessment.id, action: "FIX_BEFORE_NEXT_WAVE" };
        case "MEDIUM":
            return { id: assessment.id, action: "PLAN" };
        case "LOW":
            return { id: assessment.id, action: "MONITOR" };
        default:
            return { id: assessment.id, action: "COLLECT_EVIDENCE" };
    }
}
