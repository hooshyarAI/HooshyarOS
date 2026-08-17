import { evaluateIngestionTrust } from "./IngestionTrustGate";

const complete = {
    sourceExtractionVerified: true,
    sourceProvenanceVerified: true,
    normalizedRepresentationVerified: true,
    validationRulesPassed: true,
    reconciliationVerified: true,
    tenantScopeVerified: true,
};

describe("Ingestion trust gate", () => {
    it("trusts data only when every evidence requirement passes", () => {
        expect(evaluateIngestionTrust(complete)).toEqual({ trusted: true, blockers: [] });
    });

    it("blocks data with unverified provenance", () => {
        const result = evaluateIngestionTrust({ ...complete, sourceProvenanceVerified: false });
        expect(result.trusted).toBe(false);
        expect(result.blockers).toContain("SOURCE_PROVENANCE_NOT_VERIFIED");
    });

    it("blocks data that fails reconciliation", () => {
        const result = evaluateIngestionTrust({ ...complete, reconciliationVerified: false });
        expect(result.blockers).toContain("RECONCILIATION_NOT_VERIFIED");
    });

    it("blocks data outside the verified tenant scope", () => {
        const result = evaluateIngestionTrust({ ...complete, tenantScopeVerified: false });
        expect(result.blockers).toContain("TENANT_SCOPE_NOT_VERIFIED");
    });
});
