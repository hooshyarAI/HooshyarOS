import { evaluateAuthorizationEvidence } from "./AuthorizationEvidenceGate";

describe("Authorization evidence gate", () => {
    const valid = {
        denyByDefaultVerified: true,
        allowPathVerified: true,
        denyPathVerified: true,
        resourceOwnershipVerified: true,
        auditTrailVerified: true,
    };

    it("passes only when every authorization proof is verified", () => {
        expect(evaluateAuthorizationEvidence(valid)).toEqual({ verified: true, blockers: [] });
    });

    it("blocks missing deny-by-default evidence", () => {
        const result = evaluateAuthorizationEvidence({ ...valid, denyByDefaultVerified: false });
        expect(result.verified).toBe(false);
        expect(result.blockers).toContain("DENY_BY_DEFAULT_NOT_VERIFIED");
    });

    it("blocks missing ownership and audit evidence", () => {
        const result = evaluateAuthorizationEvidence({
            ...valid,
            resourceOwnershipVerified: false,
            auditTrailVerified: false,
        });
        expect(result.blockers).toEqual([
            "RESOURCE_OWNERSHIP_NOT_VERIFIED",
            "AUTHORIZATION_AUDIT_NOT_VERIFIED",
        ]);
    });
});
