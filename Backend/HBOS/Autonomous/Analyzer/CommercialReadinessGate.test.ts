import { evaluateCommercialReadiness } from "./CommercialReadinessGate";

const complete = {
    authorizationVerified: true,
    tenantIsolationVerified: true,
    customerDataIsolationVerified: true,
    persistenceVerified: true,
    recoveryVerified: true,
    ingestionVerified: true,
    behavioralVerificationPassed: true,
    securityVerificationPassed: true,
    customerValueEvidenceVerified: true,
};

describe("Commercial readiness gate", () => {
    it("blocks while any production-critical proof is missing", () => {
        const result = evaluateCommercialReadiness({ ...complete, tenantIsolationVerified: false });
        expect(result.status).toBe("BLOCK");
        expect(result.blockers).toContain("TENANT_ISOLATION_NOT_VERIFIED");
    });

    it("passes only when every required proof is verified", () => {
        expect(evaluateCommercialReadiness(complete)).toEqual({ status: "PASS", blockers: [] });
    });
});
