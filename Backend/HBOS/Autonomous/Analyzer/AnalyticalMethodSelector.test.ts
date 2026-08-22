import { selectAnalyticalMethods } from "./AnalyticalMethodSelector";

describe("Analytical method selector", () => {
    it("selects complementary methods from verified decision characteristics", () => {
        expect(selectAnalyticalMethods({
            strategicContext: true,
            externalEnvironment: true,
            riskDecision: true,
            multipleCriteria: true,
            alternatives: true,
            uncertainty: true,
            empiricalData: false,
            timeSeries: false,
            financialBreakEven: true,
            stakeholderDecision: false,
            scenarioPlanning: false,
            rootCauseAnalysis: false,
            evidenceVerified: true,
        })).toEqual({
            methods: [
                "SWOT",
                "PESTLE",
                "TOWS",
                "RISK_MATRIX",
                "SENSITIVITY",
                "AHP",
                "TOPSIS",
                "MONTE_CARLO",
                "BREAK_EVEN",
            ],
            confidence: "HIGH",
        });
    });

    it("fails closed when evidence is not verified", () => {
        expect(selectAnalyticalMethods({
            strategicContext: true,
            externalEnvironment: true,
            riskDecision: true,
            multipleCriteria: true,
            alternatives: true,
            uncertainty: true,
            empiricalData: true,
            timeSeries: true,
            financialBreakEven: true,
            stakeholderDecision: true,
            scenarioPlanning: true,
            rootCauseAnalysis: true,
            evidenceVerified: false,
        })).toEqual({ methods: [], confidence: "INSUFFICIENT_EVIDENCE" });
    });

    it("returns no methods when no analytical condition is present", () => {
        expect(selectAnalyticalMethods({
            strategicContext: false,
            externalEnvironment: false,
            riskDecision: false,
            multipleCriteria: false,
            alternatives: false,
            uncertainty: false,
            empiricalData: false,
            timeSeries: false,
            financialBreakEven: false,
            stakeholderDecision: false,
            scenarioPlanning: false,
            rootCauseAnalysis: false,
            evidenceVerified: true,
        })).toEqual({ methods: [], confidence: "LOW" });
    });
});
