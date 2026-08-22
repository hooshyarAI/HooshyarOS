export interface IngestionTrustEvidence {
    sourceExtractionVerified: boolean;
    sourceProvenanceVerified: boolean;
    normalizedRepresentationVerified: boolean;
    validationRulesPassed: boolean;
    reconciliationVerified: boolean;
    tenantScopeVerified: boolean;
}

export interface IngestionTrustResult {
    trusted: boolean;
    blockers: string[];
}

export function evaluateIngestionTrust(evidence: IngestionTrustEvidence): IngestionTrustResult {
    const checks: Array<[boolean, string]> = [
        [evidence.sourceExtractionVerified, "SOURCE_EXTRACTION_NOT_VERIFIED"],
        [evidence.sourceProvenanceVerified, "SOURCE_PROVENANCE_NOT_VERIFIED"],
        [evidence.normalizedRepresentationVerified, "NORMALIZED_REPRESENTATION_NOT_VERIFIED"],
        [evidence.validationRulesPassed, "VALIDATION_RULES_NOT_PASSED"],
        [evidence.reconciliationVerified, "RECONCILIATION_NOT_VERIFIED"],
        [evidence.tenantScopeVerified, "TENANT_SCOPE_NOT_VERIFIED"],
    ];
    const blockers = checks.filter(([ok]) => !ok).map(([, reason]) => reason);
    return { trusted: blockers.length === 0, blockers };
}
