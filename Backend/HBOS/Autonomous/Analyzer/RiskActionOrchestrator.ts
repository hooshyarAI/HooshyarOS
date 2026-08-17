import { RiskAssessment } from "./RiskAssessment";

export type RiskAction =
    | "BLOCK"
    | "FIX_BEFORE_NEXT_WAVE"
    | "PLAN"
    | "MONITOR"
    | "COLLECT_EVIDENCE";

export interface RiskActionResult {
    action: RiskAction;
    executable: boolean;
}

export function selectRiskAction(risk: RiskAssessment): RiskActionResult {
    if (risk.level === "INSUFFICIENT_EVIDENCE") {
        return { action: "COLLECT_EVIDENCE", executable: false };
    }
    switch (risk.level) {
        case "CRITICAL": return { action: "BLOCK", executable: false };
        case "HIGH": return { action: "FIX_BEFORE_NEXT_WAVE", executable: true };
        case "MEDIUM": return { action: "PLAN", executable: true };
        case "LOW": return { action: "MONITOR", executable: true };
    }
}
