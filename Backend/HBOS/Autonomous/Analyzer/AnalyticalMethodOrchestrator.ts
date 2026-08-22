export type AnalyticalMethod =
    | "SWOT"
    | "PESTLE"
    | "TOWS"
    | "RISK_MATRIX"
    | "SENSITIVITY"
    | "AHP"
    | "TOPSIS"
    | "DECISION_MATRIX"
    | "MONTE_CARLO"
    | "REGRESSION"
    | "HYPOTHESIS_TEST"
    | "SCENARIO_PLANNING"
    | "BREAK_EVEN"
    | "TREND"
    | "PARETO"
    | "DELPHI";

export interface AnalyticalProblem {
    type: "STRATEGIC" | "RISK" | "MULTI_CRITERIA" | "UNCERTAINTY" | "BEHAVIORAL" | "FINANCIAL" | "OPERATIONAL";
    evidenceScore: number;
    uncertainty: number;
    decisionImpact: number;
}

export interface AnalyticalMethodPlan {
    methods: AnalyticalMethod[];
    requiresMoreEvidence: boolean;
    confidenceCeiling: "LOW" | "MEDIUM" | "HIGH";
}

export function selectAnalyticalMethods(problem: AnalyticalProblem): AnalyticalMethodPlan {
    if (problem.evidenceScore < 0.6) {
        return { methods: [], requiresMoreEvidence: true, confidenceCeiling: "LOW" };
    }

    const methods: AnalyticalMethod[] = [];

    switch (problem.type) {
        case "STRATEGIC":
            methods.push("SWOT", "PESTLE", "TOWS");
            break;
        case "RISK":
            methods.push("RISK_MATRIX", "SENSITIVITY");
            break;
        case "MULTI_CRITERIA":
            methods.push(problem.decisionImpact >= 4 ? "AHP" : "DECISION_MATRIX", "TOPSIS");
            break;
        case "UNCERTAINTY":
            methods.push("MONTE_CARLO", "SENSITIVITY", "SCENARIO_PLANNING");
            break;
        case "BEHAVIORAL":
            methods.push("REGRESSION", "HYPOTHESIS_TEST", "TREND");
            break;
        case "FINANCIAL":
            methods.push("BREAK_EVEN", "SENSITIVITY", "MONTE_CARLO");
            break;
        case "OPERATIONAL":
            methods.push("TREND", "PARETO");
            break;
    }

    const confidenceCeiling = problem.evidenceScore >= 0.9 && problem.uncertainty <= 0.2
        ? "HIGH"
        : problem.evidenceScore >= 0.75
            ? "MEDIUM"
            : "LOW";

    return { methods, requiresMoreEvidence: false, confidenceCeiling };
}
