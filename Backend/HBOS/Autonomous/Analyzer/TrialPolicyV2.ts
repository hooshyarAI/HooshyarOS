export type TrialDuration = 30 | 60 | 90;
export interface TrialPolicyInput { duration: TrialDuration; readinessVerified: boolean; scopeLimited: boolean; consentRecorded: boolean; }
export function trialAllowed(p: TrialPolicyInput): boolean { return p.readinessVerified && p.scopeLimited && p.consentRecorded; }
