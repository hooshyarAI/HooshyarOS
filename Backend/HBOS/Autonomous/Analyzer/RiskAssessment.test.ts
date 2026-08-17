import { assessRisk } from "./RiskAssessment";

describe("Risk assessment", () => {
    it("calculates probability x impact and classifies critical risk", () => {
        expect(assessRisk({ id: "data-loss", probability: 5, impact: 5, evidenceVerified: true })).toEqual({
            id: "data-loss", score: 25, level: "CRITICAL",
        });
    });

    it("classifies high, medium and low risks", () => {
        expect(assessRisk({ id: "high", probability: 3, impact: 4, evidenceVerified: true }).level).toBe("HIGH");
        expect(assessRisk({ id: "medium", probability: 2, impact: 3, evidenceVerified: true }).level).toBe("MEDIUM");
        expect(assessRisk({ id: "low", probability: 1, impact: 2, evidenceVerified: true }).level).toBe("LOW");
    });

    it("fails closed when evidence is not verified", () => {
        expect(assessRisk({ id: "unknown", probability: 5, impact: 5, evidenceVerified: false })).toEqual({
            id: "unknown", score: 0, level: "INSUFFICIENT_EVIDENCE",
        });
    });
});
