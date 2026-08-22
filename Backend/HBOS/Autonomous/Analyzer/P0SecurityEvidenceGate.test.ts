import { evaluateP0SecurityEvidence } from "./P0SecurityEvidenceGate";

describe("P0 security evidence gate", () => {
    const complete = {
        authorizationDenyByDefaultVerified: true,
        authorizationPositivePathVerified: true,
        tenantIsolationVerified: true,
        customerDataIsolationVerified: true,
        auditTrailVerified: true,
        secretProtectionVerified: true,
    };

    it("blocks if any P0 security proof is missing", () => {
        const result = evaluateP0SecurityEvidence({ ...complete, tenantIsolationVerified: false });
        expect(result.status).toBe("BLOCK");
        expect(result.blockers).toContain("TENANT_ISOLATION_NOT_VERIFIED");
    });

    it("passes only when every P0 security proof is verified", () => {
        expect(evaluateP0SecurityEvidence(complete)).toEqual({ status: "PASS", blockers: [] });
    });
});
