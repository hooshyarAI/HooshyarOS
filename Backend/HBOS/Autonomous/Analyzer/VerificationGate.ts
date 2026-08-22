export interface VerificationState { behavioral: boolean; integration: boolean; adversarial: boolean; }
export function verificationPassed(state: VerificationState): boolean {
    return state.behavioral && state.integration && state.adversarial;
}
