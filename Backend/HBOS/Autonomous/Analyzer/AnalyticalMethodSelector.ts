export type AnalyticalMethod =
    | "SWOT" | "PESTLE" | "RISK_MATRIX" | "SENSITIVITY"
    | "AHP" | "TOPSIS" | "MONTE_CARLO" | "REGRESSION"
    | "HYPOTHESIS_TEST" | "TOWS" | "STAKEHOLDER" | "SCENARIO"
    | "BREAK_EVEN" | "DELPHI" | "DECISION_MATRIX" | "TREND" | "PARETO";

export interface AnalyticalMethodSelectionInput {
    strategicContext: boolean;
    externalEnvironment: boolean;
    riskDecision: boolean;
    multipleCriteria: boolean;
    alternatives: boolean;
    uncertainty: boolean;
    empiricalData: boolean;
    timeSeries: boolean;
    financialBreakEven: boolean;
    stakeholderDecision: boolean;
    scenarioPlanning: boolean;
    rootCauseAnalysis: boolean;
    evidenceVerified: boolean;
}

export interface AnalyticalMethodSelection {
    methods: AnalyticalMethod[];
    confidence: "HIGH" | "LOW" | "INSUFFICIENT_EVIDENCE";
}

export function selectAnalyticalMethods(input: AnalyticalMethodSelectionInput): AnalyticalMethodSelection {
    if (!input.evidenceVerified) return { methods: [], confidence: "INSUFFICIENT_EVIDENCE" };

    const methods: AnalyticalMethod[] = [];
    if (input.strategicContext) methods.push("SWOT");
    if (input.externalEnvironment) methods.push("PESTLE");
    if (input.strategicContext && input.externalEnvironment) methods.push("TOWS");
    if (input.riskDecision) methods.push("RISK_MATRIX", "SENSITIVITY");
    if (input.multipleCriteria && input.alternatives) methods.push("AHP", "TOPSIS");
    if (input.multipleCriteria && !input.alternatives) methods.push("DECISION_MATRIX");
    if (input.uncertainty) methods.push("MONTE_CARLO");
    if (input.empiricalData) methods.push("REGRESSION", "HYPOTHESIS_TEST");
    if (input.timeSeries) methods.push("TREND");
    if (input.financialBreakEven) methods.push("BREAK_EVEN");
    if (input.stakeholderDecision) methods.push("STAKEHOLDER", "DELPHI");
    if (input.scenarioPlanning) methods.push("SCENARIO");
    if (input.rootCauseAnalysis) methods.push("PARETO");

    return { methods: [...new Set(methods)], confidence: methods.length ? "HIGH" : "LOW" };
}
