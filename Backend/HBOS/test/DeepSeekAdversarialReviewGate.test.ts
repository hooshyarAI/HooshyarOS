import { DeepSeekAdversarialReviewGate, DeepSeekReviewInput } from "../Architecture/Review/DeepSeekAdversarialReviewGate";

describe("DeepSeekAdversarialReviewGate", () => {
    const base: DeepSeekReviewInput = {
        decisionId: "decision-1",
        risk: "HIGH",
        material: true,
        irreversible: false,
        category: "PRODUCTIZATION",
        evidence: ["repository diff", "focused test result"],
        alternatives: ["strategy-a", "strategy-b"],
        verdict: "ALLOW_WITH_CONDITIONS",
        findings: [],
        recommendation: "Use the governed repair path.",
        verificationCriteria: ["focused regression", "artifact verification"],
    };

    it("requires independent review for material high-risk productization decisions", () => {
        const result = new DeepSeekAdversarialReviewGate().evaluate(base);
        expect(result.required).toBe(true);
        expect(result.allowed).toBe(true);
        expect(result.missingEvidence).toEqual([]);
    });

    it("blocks when an independent review identifies a high-severity finding", () => {
        const result = new DeepSeekAdversarialReviewGate().evaluate({
            ...base,
            findings: [
                {
                    id: "finding-1",
                    severity: "HIGH",
                    statement: "The proposed repair bypasses a verification boundary.",
                    evidence: ["architecture audit"],
                    rationale: "It would weaken the acceptance gate.",
                },
            ],
        });
        expect(result.allowed).toBe(false);
        expect(result.blockingFindings).toHaveLength(1);
    });

    it("blocks incomplete mandatory review evidence", () => {
        const result = new DeepSeekAdversarialReviewGate().evaluate({
            ...base,
            evidence: [],
            alternatives: [],
            recommendation: "",
            verificationCriteria: [],
        });
        expect(result.allowed).toBe(false);
        expect(result.missingEvidence).toEqual([
            "independent-review-evidence",
            "reviewed-alternatives",
            "actionable-recommendation",
            "verification-criteria",
        ]);
    });

    it("never overrides an explicit BLOCK verdict", () => {
        const result = new DeepSeekAdversarialReviewGate().evaluate({
            ...base,
            verdict: "BLOCK",
        });
        expect(result.allowed).toBe(false);
        expect(result.reasons).toContain("independent reviewer verdict is BLOCK");
    });
});
