export interface RiskInput { probability: number; impact: number; }
export interface RiskResult { score: number; level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; }
const clamp = (n: number) => Math.max(0, Math.min(100, n));
export function calculateRisk(input: RiskInput): RiskResult {
    const score = clamp(input.probability) * clamp(input.impact) / 100;
    const level = score >= 80 ? "CRITICAL" : score >= 60 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW";
    return { score, level };
}
