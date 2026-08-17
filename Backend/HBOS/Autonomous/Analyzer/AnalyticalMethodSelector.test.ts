import { selectAnalyticalMethods } from "./AnalyticalMethodSelector";

describe("Analytical method selector", () => {
    it("selects complementary methods from decision characteristics", () => {
        expect(selectAnalyticalMethods({
            strategicContext: true,
            externalEnvironment: true,
            riskDecision: true,
            multipleCriteria: true,
            uncertainty: true,
            empiricalData: false,
            timeSeries: false,
            financialBreakEven: true,
        })).toEqual([
            "SWOT",
            "PESTLE",
            "RISK_MATRIX",
            "SENSITIVITY",
            "AHP",
            "TOPSIS",
            "DECISION_MATRIX",
            "MONTE_CARLO",
            "BREAK_EVEN",
        ]);
    });

    it("returns no methods when no analytical condition is present", () => {
        expect(selectAnalyticalMethods({
            strategicContext: false,
            externalEnvironment: false,
            riskDecision: false,
            multipleCriteria: false,
            uncertainty: false,
            empiricalData: false,
            timeSeries: false,
            financialBreakEven: false,
        })).toEqual([]);
    });
});
