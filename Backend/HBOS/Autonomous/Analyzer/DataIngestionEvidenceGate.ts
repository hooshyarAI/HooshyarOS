export type IngestionSource = "PHOTO" | "VIDEO" | "PAPER" | "PDF" | "WORD" | "EXCEL" | "ACCESS" | "SOFTWARE" | "API" | "GATEWAY";

export interface DataIngestionEvidence {
    source: IngestionSource;
    extractionVerified: boolean;
    normalizationVerified: boolean;
    validationVerified: boolean;
    provenanceVerified: boolean;
    duplicateDetectionVerified: boolean;
    failedInputDoesNotBecomeTrustedData: boolean;
    tenantBoundaryVerified: boolean;
}

export interface DataIngestionEvidenceResult {
    verified: boolean;
    blockers: string[];
}

export function evaluateDataIngestionEvidence(
    evidence: DataIngestionEvidence,
): DataIngestionEvidenceResult {
    const checks: Array<[boolean, string]> = [
        [evidence.extractionVerified, "EXTRACTION_NOT_VERIFIED"],
        [evidence.normalizationVerified, "NORMALIZATION_NOT_VERIFIED"],
        [evidence.validationVerified, "VALIDATION_NOT_VERIFIED"],
        [evidence.provenanceVerified, "PROVENANCE_NOT_VERIFIED"],
        [evidence.duplicateDetectionVerified, "DUPLICATE_DETECTION_NOT_VERIFIED"],
        [evidence.failedInputDoesNotBecomeTrustedData, "FAILED_INPUT_CAN_BECOME_TRUSTED_DATA"],
        [evidence.tenantBoundaryVerified, "INGESTION_TENANT_BOUNDARY_NOT_VERIFIED"],
    ];
    const blockers = checks.filter(([ok]) => !ok).map(([, reason]) => reason);
    return { verified: blockers.length === 0, blockers };
}
