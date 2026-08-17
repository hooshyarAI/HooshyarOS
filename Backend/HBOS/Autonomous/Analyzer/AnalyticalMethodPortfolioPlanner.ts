export type AnalyticalMethodRole = "CONTEXT" | "RISK" | "DECISION" | "UNCERTAINTY" | "EVIDENCE" | "MONITORING";

export interface AnalyticalMethodPortfolioInput {
    methods: string[];
    evidenceVerified: boolean;
    highStakes: boolean;
}

export interface AnalyticalMethodPortfolio {
    orderedMethods: string[];
    roles: Record<string, AnalyticalMethodRole>;
    blockedMethods: string[];
    executionAllowed: boolean;
}

const ROLE_BY_METHOD: Record<string, AnalyticalMethodRole> = {
    SWOT: "CONTEXT",
    PESTLE: "CONTEXT",
    TOWS: "DECISION",
    STAKEHOLDER: "CONTEXT",
    RISK_MATRIX: "RISK",
    SENSITIVITY: "UNCERTAINTY",
    AHP: "DECISION",
    TOPSIS: "DECISION",
    DECISION_MATRIX: "DECISION",
    MONTE_CARLO: "UNCERTAINTY",
    REGRESSION: "EVIDENCE",
    HYPOTHESIS_TEST: "EVIDENCE",
    SCENARIO: "UNCERTAINTY",
    BREAK_EVEN: "DECISION",
    DELPHI: "CONTEXT",
    TREND: "MONITORING",
    PARETO: "MONITORING",
};

const ORDER: Record<AnalyticalMethodRole, number> = {
    CONTEXT: 1,
    EVIDENCE: 2,
    RISK: 3,
    UNCERTAINTY: 4,
    DECISION: 5,
    MONITORING: 6,
};

export class AnalyticalMethodPortfolioPlanner {
    plan(input: AnalyticalMethodPortfolioInput): AnalyticalMethodPortfolio {
        const blockedMethods = input.methods.filter((method) => !ROLE_BY_METHOD[method]);
        const validMethods = input.methods.filter((method) => ROLE_BY_METHOD[method]);

        if (!input.evidenceVerified) {
            return {
                orderedMethods: [],
                roles: {},
                blockedMethods: [...new Set([...blockedMethods, ...validMethods])],
                executionAllowed: false,
            };
        }

        const roles = Object.fromEntries(
            validMethods.map((method) => [method, ROLE_BY_METHOD[method]]),
        ) as Record<string, AnalyticalMethodRole>;

        const orderedMethods = [...new Set(validMethods)].sort(
            (a, b) => ORDER[ROLE_BY_METHOD[a]] - ORDER[ROLE_BY_METHOD[b]],
        );

        const hasRiskMethod = orderedMethods.some((method) => ROLE_BY_METHOD[method] === "RISK");
        const hasDecisionMethod = orderedMethods.some((method) => ROLE_BY_METHOD[method] === "DECISION");
        const executionAllowed = !input.highStakes || (hasRiskMethod && hasDecisionMethod);

        return {
            orderedMethods,
            roles,
            blockedMethods,
            executionAllowed,
        };
    }
}
