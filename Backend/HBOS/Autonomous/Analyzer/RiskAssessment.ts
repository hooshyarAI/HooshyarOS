export type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_EVIDENCE";

export interface RiskAssessment {
    level: RiskLevel;
    reasons?: string[];
    evidence?: string[];
}
