export interface VerificationContract { behavioral: boolean; integration: boolean; adversarial: boolean; }
export function verificationReady(v: VerificationContract): boolean { return v.behavioral && v.integration && v.adversarial; }
