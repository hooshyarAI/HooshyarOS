import { AnalyticalMethodPortfolioPlanner } from "./AnalyticalMethodPortfolioPlanner";

describe("AnalyticalMethodPortfolioPlanner", () => {
    it("orders methods and requires risk plus decision analysis for high-stakes execution", () => {
        const planner = new AnalyticalMethodPortfolioPlanner();
        expect(planner.plan({ methods: ["AHP", "SWOT", "RISK_MATRIX", "MONTE_CARLO"], evidenceVerified: true, highStakes: true })).toEqual({ orderedMethods: ["SWOT", "RISK_MATRIX", "MONTE_CARLO", "AHP"], roles: { AHP: "DECISION", SWOT: "CONTEXT", RISK_MATRIX: "RISK", MONTE_CARLO: "UNCERTAINTY" }, blockedMethods: [], executionAllowed: true });
    });

    it("fails closed when evidence is not verified", () => {
        const planner = new AnalyticalMethodPortfolioPlanner();
        expect(planner.plan({ methods: ["SWOT", "AHP"], evidenceVerified: false, highStakes: false })).toEqual({ orderedMethods: [], roles: {}, blockedMethods: ["SWOT", "AHP"], executionAllowed: false });
    });
});
