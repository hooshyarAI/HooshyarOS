export interface VerificationPlan { capability:string; behavioralTests:string[]; integrationTests:string[]; adversarialTests:string[]; }
export function createVerificationPlan(capability:string, behavioralTests:string[], integrationTests:string[], adversarialTests:string[]): VerificationPlan { return {capability,behavioralTests,integrationTests,adversarialTests}; }
