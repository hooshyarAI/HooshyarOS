export type CommercialGateStatus = "PASS" | "BLOCK";

export interface CommercialReadinessInput {
    authorizationVerified: boolean;
    tenantIsolationVerified: boolean;
    customerDataIsolationVerified: boolean;
    persistenceVerified: boolean;
    recoveryVerified: boolean;
    ingestionVerified: boolean;
    behavioralVerificationPassed: boolean;
    securityVerificationPassed: boolean;
    customerValueEvidenceVerified: boolean;
}

export interface CommercialReadinessResult {
    status: CommercialGateStatus;
    blockers: string[];
}

export function evaluateCommercialReadiness(input: CommercialReadinessInput): CommercialReadinessResult {
    const checks: Array<[keyof CommercialReadinessInput, string]> = [
        ["authorizationVerified", "AUTHORIZATION_NOT_VERIFIED"],
        ["tenantIsolationVerified", "TENANT_ISOLATION_NOT_VERIFIED"],
        ["customerDataIsolationVerified", "CUSTOMER_DATA_ISOLATION_NOT_VERIFIED"],
        ["persistenceVerified", "PERSISTENCE_NOT_VERIFIED"],
        ["recoveryVerified", "RECOVERY_NOT_VERIFIED"],
        ["ingestionVerified", "INGESTION_NOT_VERIFIED"],
        ["behavioralVerificationPassed", "BEHAVIORAL_VERIFICATION_FAILED"],
        ["securityVerificationPassed", "SECURITY_VERIFICATION_FAILED"],
        ["customerValueEvidenceVerified", "CUSTOMER_VALUE_EVIDENCE_NOT_VERIFIED"],
    ];
    const blockers = checks.filter(([key]) => !input[key]).map(([, reason]) => reason);
    return { status: blockers.length === 0 ? "PASS" : "BLOCK", blockers };
}
