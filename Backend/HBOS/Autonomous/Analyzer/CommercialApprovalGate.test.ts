import { evaluateCommercialApproval } from "./CommercialApprovalGate";

describe("Commercial approval gate", () => {
    const ready = {
        offerPackageId: "offer-a",
        approvalLevel: "AUTHORIZED" as const,
        securityIsolationVerified: true,
        productReadinessVerified: true,
        valueProven: true,
    };

    it("approves only an evidence-backed offer with authorized approval", () => {
        expect(evaluateCommercialApproval(ready)).toEqual({
            approved: true,
            reason: "COMMERCIAL_APPROVAL_GRANTED",
        });
    });

    it("blocks unauthorized approval", () => {
        const result = evaluateCommercialApproval({
            ...ready,
            approvalLevel: "UNAUTHORIZED",
        });
        expect(result.approved).toBe(false);
        expect(result.reason).toBe("APPROVAL_NOT_AUTHORIZED");
    });

    it("blocks approval when security isolation is unverified", () => {
        const result = evaluateCommercialApproval({
            ...ready,
            securityIsolationVerified: false,
        });
        expect(result.approved).toBe(false);
        expect(result.reason).toBe("SECURITY_ISOLATION_NOT_VERIFIED");
    });
});
