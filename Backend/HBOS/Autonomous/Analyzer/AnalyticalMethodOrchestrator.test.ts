import { selectAnalyticalMethods } from "./AnalyticalMethodOrchestrator";

describe("Analytical method orchestrator", () => {
    it("fails closed when evidence is insufficient", () => {
        expect(selectAnalyticalMethods({
            type: "RISK", evidenceScore: 0.5, uncertainty: 0.2, decisionImpact: 5,
        })).toEqual({ methods: [], requiresMoreEvidence: true, confidenceCeiling: "LOW" });
    });

    it("selects risk methods for risk decisions", () => {
        expect(selectAnalyticalMethods({
            type: "RISK", evidenceScore: 0.9, uncertainty: 0.1, decisionImpact: 5,
        })).toEqual({
            methods: ["RISK_MATRIX", "SENSITIVITY"],
            requiresMoreEvidence: false,
            confidenceCeiling: "HIGH",
        });
    });

    it("selects uncertainty methods without treating them as universal", () => {
        expect(selectAnalyticalMethods({
            type: "UNCERTAINTY", evidenceScore: 0.8, uncertainty: 0.7, decisionImpact: 4,
        }).methods).toEqual(["MONTE_CARLO", "SENSITIVITY", "SCENARIO_PLANNING"]);
    });
});
