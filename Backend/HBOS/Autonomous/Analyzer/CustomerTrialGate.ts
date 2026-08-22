export interface CustomerTrialInput { commercialReady: boolean; scopeDefined: boolean; slaDefined: boolean; dataBoundaryVerified: boolean; }
export function trialAllowed(input: CustomerTrialInput): boolean {
    return input.commercialReady && input.scopeDefined && input.slaDefined && input.dataBoundaryVerified;
}
