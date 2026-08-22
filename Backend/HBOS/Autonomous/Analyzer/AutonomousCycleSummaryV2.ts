export interface CycleSummary { executed: boolean; verified: boolean; reevaluationRequired: boolean; commercialReady: boolean; blockers: string[]; }
export function cycleComplete(s: CycleSummary): boolean { return s.executed && s.verified && !s.reevaluationRequired && s.blockers.length === 0; }
