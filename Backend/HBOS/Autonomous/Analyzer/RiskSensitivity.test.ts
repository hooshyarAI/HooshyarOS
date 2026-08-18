import { analyzeRiskSensitivity } from "./RiskSensitivity";

describe("Risk sensitivity analysis", () => {
    it("detects an unstable risk decision when plausible inputs cross levels", () => {
        expect(analyzeRiskSensitivity({
            probability: 3,
            impact: 4,
            probabilityDelta: 1,
            impactDelta: 1,
        })).toEqual({
            baselineScore: 12,
            minScore: 6,
            maxScore: 20,
            decisionStable: false,
        });
    });

    it("marks a decision stable when the risk level does not change", () => {
        expect(analyzeRiskSensitivity({
            probability: 1,
            impact: 1,
            probabilityDelta: 1,
            impactDelta: 1,
        })).toEqual({
            baselineScore: 1,
            minScore: 0,
            maxScore: 4,
            decisionStable: true,
        });
    });
});
