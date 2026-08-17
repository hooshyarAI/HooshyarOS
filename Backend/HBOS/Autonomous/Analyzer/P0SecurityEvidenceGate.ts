export interface P0SecurityEvidence {
    authorizationDenyByDefaultVerified: boolean;
    authorizationPositivePathVerified: boolean;
    tenantIsolationVerified: boolean;
    customerDataIsolationVerified: boolean;
    auditTrailVerified: boolean;
    secretProtectionVerified: boolean;
}

export interface P0SecurityGateResult {
    status: "PASS" | "BLOCK";
    blockers: string[];
}

export function evaluateP0SecurityEvidence(evidence: P0SecurityEvidence): P0SecurityGateResult {
    const checks: Array<[keyof P0SecurityEvidence, string]> = [
        ["authorizationDenyByDefaultVerified", "AUTH_DENY_BY_DEFAULT_NOT_VERIFIED"],
        ["authorizationPositivePathVerified", "AUTH_POSITIVE_PATH_NOT_VERIFIED"],
        ["tenantIsolationVerified", "TENANT_ISOLATION_NOT_VERIFIED"],
        ["customerDataIsolationVerified", "CUSTOMER_DATA_ISOLATION_NOT_VERIFIED"],
        ["auditTrailVerified", "AUDIT_TRAIL_NOT_VERIFIED"],
        ["secretProtectionVerified", "SECRET_PROTECTION_NOT_VERIFIED"],
    ];
    const blockers = checks.filter(([key]) => !evidence[key]).map(([, reason]) => reason);
    return { status: blockers.length === 0 ? "PASS" : "BLOCK", blockers };
}
