export type AnalyticalMethod =
    | "SWOT"
    | "PESTLE"
    | "RISK_MATRIX"
    | "SENSITIVITY"
    | "AHP"
    | "TOPSIS"
    | "MONTE_CARLO"
    | "REGRESSION"
    | "HYPOTHESIS_TEST"
    | "STAKEHOLDER"
    | "SCENARIO"
    | "BREAK_EVEN"
    | "DELPHI"
    | "DECISION_MATRIX"
    | "TREND"
    | "PARETO";

export interface AnalyticalMethodSelectionInput {
    strategicContext: boolean;
    externalEnvironment: boolean;
    riskDecision: boolean;
    multipleCriteria: boolean;
    uncertainty: boolean;
    empiricalData: boolean;
    timeSeries: boolean;
    financialBreakEven: boolean;
}

export function selectAnalyticalMethods(
    input: AnalyticalMethodSelectionInput,
): AnalyticalMethod[] {
    const methods: AnalyticalMethod[] = [];

    if (input.strategicContext) methods.push("SWOT");
    if (input.externalEnvironment) methods.push("PESTLE");
    if (input.riskDecision) methods.push("RISK_MATRIX", "SENSITIVITY");
    if (input.multipleCriteria) methods.push("AHP", "TOPSIS", "DECISION_MATRIX");
    if (input.uncertainty) methods.push("MONTE_CARLO");
    if (input.empiricalData) methods.push("REGRESSION", "HYPOTHESIS_TEST");
    if (input.timeSeries) methods.push("TREND", "PARETO");
    if (input.financialBreakEven) methods.push("BREAK_EVEN");

    return [...new Set(methods)];
}
