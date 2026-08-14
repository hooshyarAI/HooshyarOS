export type DeepSeekReviewRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type DeepSeekReviewVerdict = "ALLOW" | "ALLOW_WITH_CONDITIONS" | "BLOCK";

export interface DeepSeekReviewFinding {
    id: string;
    severity: DeepSeekReviewRisk;
    statement: string;
    evidence: string[];
    rationale: string;
}

export interface DeepSeekReviewInput {
    decisionId: string;
    risk: DeepSeekReviewRisk;
    material: boolean;
    irreversible: boolean;
    category: "ARCHITECTURE" | "DESIGN" | "PERFORMANCE" | "SECURITY" | "RELIABILITY" | "PRODUCTIZATION" | "REPAIR";
    evidence: string[];
    alternatives: string[];
    verdict: DeepSeekReviewVerdict;
    findings: DeepSeekReviewFinding[];
    recommendation: string;
    verificationCriteria: string[];
}

export interface DeepSeekReviewDecision {
    required: boolean;
    allowed: boolean;
    verdict: DeepSeekReviewVerdict;
    blockingFindings: DeepSeekReviewFinding[];
    missingEvidence: string[];
    reasons: string[];
}

const HIGH_RISK: ReadonlySet<DeepSeekReviewRisk> = new Set(["HIGH", "CRITICAL"]);
const MATERIAL_CATEGORIES: ReadonlySet<DeepSeekReviewInput["category"]> = new Set([
    "ARCHITECTURE",
    "SECURITY",
    "RELIABILITY",
    "PRODUCTIZATION",
    "REPAIR",
    "PERFORMANCE",
]);

export class DeepSeekAdversarialReviewGate {
    evaluate(input: DeepSeekReviewInput): DeepSeekReviewDecision {
        const required =
            input.material ||
            input.irreversible ||
            HIGH_RISK.has(input.risk) ||
            MATERIAL_CATEGORIES.has(input.category);

        const missingEvidence: string[] = [];
        if (required && input.evidence.length === 0) missingEvidence.push("independent-review-evidence");
        if (required && input.alternatives.length === 0) missingEvidence.push("reviewed-alternatives");
        if (required && input.recommendation.trim().length === 0) missingEvidence.push("actionable-recommendation");
        if (required && input.verificationCriteria.length === 0) missingEvidence.push("verification-criteria");

        const blockingFindings = input.findings.filter(
            (finding) => finding.severity === "CRITICAL" || finding.severity === "HIGH",
        );

        const reasons: string[] = [];
        if (required) reasons.push("independent adversarial review is mandatory for this decision class");
        if (blockingFindings.length > 0) reasons.push("DeepSeek identified material findings that block advancement");
        if (missingEvidence.length > 0) reasons.push("required adversarial review evidence is incomplete");
        if (input.verdict === "BLOCK") reasons.push("independent reviewer verdict is BLOCK");

        const allowed =
            input.verdict !== "BLOCK" &&
            blockingFindings.length === 0 &&
            missingEvidence.length === 0;

        return {
            required,
            allowed,
            verdict: input.verdict,
            blockingFindings,
            missingEvidence,
            reasons,
        };
    }
}
