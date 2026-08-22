export interface ReevaluationInput { beforeEvidence: string; afterEvidence: string; executionSucceeded: boolean; }
export function requiresReevaluation(input: ReevaluationInput): boolean {
    return !input.executionSucceeded || input.beforeEvidence === input.afterEvidence;
}
