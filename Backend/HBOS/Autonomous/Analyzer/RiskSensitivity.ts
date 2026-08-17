export interface RiskSensitivityInput {
    probability: number;
    impact: number;
    probabilityDelta: number;
    impactDelta: number;
}

export interface RiskSensitivityResult {
    baselineScore: number;
    minScore: number;
    maxScore: number;
    decisionStable: boolean;
}

export function analyzeRiskSensitivity(input: RiskSensitivityInput): RiskSensitivityResult {
    const clamp = (value: number) => Math.max(0, Math.min(5, value));
    const p = clamp(input.probability);
    const i = clamp(input.impact);
    const pLow = clamp(p - Math.abs(input.probabilityDelta));
    const pHigh = clamp(p + Math.abs(input.probabilityDelta));
    const iLow = clamp(i - Math.abs(input.impactDelta));
    const iHigh = clamp(i + Math.abs(input.impactDelta));

    const baselineScore = p * i;
    const minScore = pLow * iLow;
    const maxScore = pHigh * iHigh;

    const level = (score: number) => score >= 20 ? "CRITICAL" : score >= 12 ? "HIGH" : score >= 6 ? "MEDIUM" : "LOW";

    return {
        baselineScore,
        minScore,
        maxScore,
        decisionStable: level(minScore) === level(maxScore),
    };
}
