import { evaluateDataIngestionEvidence } from "./DataIngestionEvidenceGate";

const complete = {
    source: "PDF" as const,
    extractionVerified: true,
    normalizationVerified: true,
    validationVerified: true,
    provenanceVerified: true,
    duplicateDetectionVerified: true,
    failedInputDoesNotBecomeTrustedData: true,
    tenantBoundaryVerified: true,
};

describe("Data ingestion evidence gate", () => {
    it("passes only with complete ingestion evidence", () => {
        expect(evaluateDataIngestionEvidence(complete)).toEqual({ verified: true, blockers: [] });
    });

    it("blocks unvalidated extraction", () => {
        const result = evaluateDataIngestionEvidence({ ...complete, validationVerified: false });
        expect(result.blockers).toContain("VALIDATION_NOT_VERIFIED");
    });

    it("prevents failed input from becoming trusted data", () => {
        const result = evaluateDataIngestionEvidence({ ...complete, failedInputDoesNotBecomeTrustedData: false });
        expect(result.blockers).toContain("FAILED_INPUT_CAN_BECOME_TRUSTED_DATA");
    });

    it("requires tenant isolation at ingestion", () => {
        const result = evaluateDataIngestionEvidence({ ...complete, tenantBoundaryVerified: false });
        expect(result.blockers).toContain("INGESTION_TENANT_BOUNDARY_NOT_VERIFIED");
    });
});
