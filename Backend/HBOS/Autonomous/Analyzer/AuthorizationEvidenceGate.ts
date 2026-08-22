export interface AuthorizationEvidence {
    denyByDefaultVerified: boolean;
    allowPathVerified: boolean;
    denyPathVerified: boolean;
    resourceOwnershipVerified: boolean;
    auditTrailVerified: boolean;
}

export interface AuthorizationEvidenceResult {
    verified: boolean;
    blockers: string[];
}

export function evaluateAuthorizationEvidence(evidence: AuthorizationEvidence): AuthorizationEvidenceResult {
    const checks: Array<[boolean, string]> = [
        [evidence.denyByDefaultVerified, "DENY_BY_DEFAULT_NOT_VERIFIED"],
        [evidence.allowPathVerified, "ALLOW_PATH_NOT_VERIFIED"],
        [evidence.denyPathVerified, "DENY_PATH_NOT_VERIFIED"],
        [evidence.resourceOwnershipVerified, "RESOURCE_OWNERSHIP_NOT_VERIFIED"],
        [evidence.auditTrailVerified, "AUTHORIZATION_AUDIT_NOT_VERIFIED"],
    ];
    const blockers = checks.filter(([ok]) => !ok).map(([, reason]) => reason);
    return { verified: blockers.length === 0, blockers };
}
