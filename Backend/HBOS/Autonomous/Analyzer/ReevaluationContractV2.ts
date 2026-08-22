export interface ReevaluationInput { previousStatus: string; currentStatus: string; blockers: string[]; }
export function needsReevaluation(input: ReevaluationInput): boolean { return input.previousStatus !== input.currentStatus || input.blockers.length > 0; }
