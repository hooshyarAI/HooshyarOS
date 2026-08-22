export interface TenantIsolationEvidence {
    requestTenantBoundaryVerified: boolean;
    resourceTenantBoundaryVerified: boolean;
    crossTenantReadBlocked: boolean;
    crossTenantWriteBlocked: boolean;
    missingTenantContextFailsClosed: boolean;
}

export interface TenantIsolationEvidenceResult {
    verified: boolean;
    blockers: string[];
}

export function evaluateTenantIsolationEvidence(
    evidence: TenantIsolationEvidence,
): TenantIsolationEvidenceResult {
    const checks: Array<[boolean, string]> = [
        [evidence.requestTenantBoundaryVerified, "REQUEST_TENANT_BOUNDARY_NOT_VERIFIED"],
        [evidence.resourceTenantBoundaryVerified, "RESOURCE_TENANT_BOUNDARY_NOT_VERIFIED"],
        [evidence.crossTenantReadBlocked, "CROSS_TENANT_READ_NOT_BLOCKED"],
        [evidence.crossTenantWriteBlocked, "CROSS_TENANT_WRITE_NOT_BLOCKED"],
        [evidence.missingTenantContextFailsClosed, "MISSING_TENANT_CONTEXT_NOT_FAIL_CLOSED"],
    ];
    const blockers = checks.filter(([ok]) => !ok).map(([, reason]) => reason);
    return { verified: blockers.length === 0, blockers };
}
