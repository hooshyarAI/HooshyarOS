import { evaluateTenantIsolationEvidence } from "./TenantIsolationEvidenceGate";

const complete = {
    requestTenantBoundaryVerified: true,
    resourceTenantBoundaryVerified: true,
    crossTenantReadBlocked: true,
    crossTenantWriteBlocked: true,
    missingTenantContextFailsClosed: true,
};

describe("Tenant isolation evidence gate", () => {
    it("passes only when all tenant boundaries are verified", () => {
        expect(evaluateTenantIsolationEvidence(complete)).toEqual({ verified: true, blockers: [] });
    });

    it("blocks cross-tenant reads", () => {
        const result = evaluateTenantIsolationEvidence({ ...complete, crossTenantReadBlocked: false });
        expect(result.verified).toBe(false);
        expect(result.blockers).toContain("CROSS_TENANT_READ_NOT_BLOCKED");
    });

    it("requires fail-closed behavior without tenant context", () => {
        const result = evaluateTenantIsolationEvidence({ ...complete, missingTenantContextFailsClosed: false });
        expect(result.blockers).toContain("MISSING_TENANT_CONTEXT_NOT_FAIL_CLOSED");
    });
});
