export interface RiskEvidence {
    id: string;
    probability: number;
    impact: number;
    evidenceVerified: boolean;
}

export interface RiskAssessment {
    id: string;
    score: number;
    level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "INSUFFICIENT_EVIDENCE";
}

export function assessRisk(evidence: RiskEvidence): RiskAssessment {
    if (!evidence.id || !evidence.evidenceVerified) {
        return { id: evidence.id, score: 0, level: "INSUFFICIENT_EVIDENCE" };
    }

    const probability = Math.max(0, Math.min(5, evidence.probability));
    const impact = Math.max(0, Math.min(5, evidence.impact));
    const score = probability * impact;

    const level = score >= 20
        ? "CRITICAL"
        : score >= 12
            ? "HIGH"
            : score >= 6
                ? "MEDIUM"
                : "LOW";

    return { id: evidence.id, score, level };
}
