export type FailureTheoryStatus =
    | "SAFE"
    | "MITIGATE"
    | "UNSTABLE"
    | "REJECTED"
    | "BLOCKED";

export interface FailureTheoryAssessment {
    failureModes: string[];
    evidence: string[];
    evidenceConfidence: number;
    independentVerification: boolean;
    contradiction: boolean;
    expectedLoss: number;
    worstCaseLoss: number;
    riskBudget: number;
    sensitivityStable: boolean;
    reversible: boolean;
    detectable: boolean;
    mitigationAvailable?: boolean;
}

export interface FailureTheoryResult {
    status: FailureTheoryStatus;
    expectedLoss: number;
    worstCaseLoss: number;
    uncertaintyPremium: number;
    riskBudget: number;
    reasons: string[];
}

export class FailureTheoryEngine {
    evaluate(assessment: FailureTheoryAssessment): FailureTheoryResult {
        const reasons: string[] = [];

        if (!assessment ||
            !Array.isArray(assessment.failureModes) ||
            assessment.failureModes.length === 0 ||
            !Array.isArray(assessment.evidence) ||
            assessment.evidence.length === 0 ||
            !Number.isFinite(assessment.evidenceConfidence) ||
            assessment.evidenceConfidence < 0 ||
            assessment.evidenceConfidence > 1 ||
            !Number.isFinite(assessment.expectedLoss) ||
            assessment.expectedLoss < 0 ||
            !Number.isFinite(assessment.worstCaseLoss) ||
            assessment.worstCaseLoss < assessment.expectedLoss ||
            !Number.isFinite(assessment.riskBudget) ||
            assessment.riskBudget < 0) {
            return this.blockedResult(assessment, ["invalid-or-missing-failure-theory-assessment"]);
        }

        if (assessment.contradiction) {
            reasons.push("contradictory-evidence");
        }

        if (!assessment.independentVerification) {
            reasons.push("independent-verification-unavailable");
        }

        if (assessment.evidenceConfidence < 0.5) {
            reasons.push("low-confidence-evidence");
        }

        if (reasons.length > 0) {
            return this.result("BLOCKED", assessment, reasons);
        }

        if (assessment.worstCaseLoss > assessment.riskBudget) {
            if (assessment.mitigationAvailable) {
                return this.result("MITIGATE", assessment, ["worst-case-loss-exceeds-risk-budget"]);
            }
            return this.result("REJECTED", assessment, ["worst-case-loss-exceeds-risk-budget"]);
        }

        if (!assessment.sensitivityStable) {
            return this.result("UNSTABLE", assessment, ["decision-reverses-under-plausible-sensitivity"]);
        }

        return this.result("SAFE", assessment, [
            assessment.reversible ? "reversible-downside" : "irreversible-downside-reviewed",
            assessment.detectable ? "failure-detectability-reviewed" : "low-detectability-reviewed"
        ]);
    }

    private blockedResult(
        assessment: FailureTheoryAssessment | undefined,
        reasons: string[]
    ): FailureTheoryResult {
        return {
            status: "BLOCKED",
            expectedLoss: assessment?.expectedLoss ?? 0,
            worstCaseLoss: assessment?.worstCaseLoss ?? 0,
            uncertaintyPremium: 0,
            riskBudget: assessment?.riskBudget ?? 0,
            reasons
        };
    }

    private result(
        status: FailureTheoryStatus,
        assessment: FailureTheoryAssessment,
        reasons: string[]
    ): FailureTheoryResult {
        return {
            status,
            expectedLoss: assessment.expectedLoss,
            worstCaseLoss: assessment.worstCaseLoss,
            uncertaintyPremium: assessment.worstCaseLoss - assessment.expectedLoss,
            riskBudget: assessment.riskBudget,
            reasons
        };
    }
}
