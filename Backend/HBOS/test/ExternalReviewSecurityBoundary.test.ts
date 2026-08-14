import { ExternalReviewSecurityBoundary } from "../Architecture/Review/ExternalReviewSecurityBoundary";

describe("ExternalReviewSecurityBoundary", () => {
    const boundary = new ExternalReviewSecurityBoundary();

    it("blocks credentials and secrets", () => {
        const result = boundary.evaluate({
            decisionId: "repair-1",
            category: "REPAIR",
            evidence: ["api_key: sk-secret-value"],
            alternatives: ["focused repair"],
        });

        expect(result.allowed).toBe(false);
        expect(result.reasons.join(" ")).toMatch(/secret|credential/i);
    });

    it("blocks customer-sensitive evidence before external transmission", () => {
        const result = boundary.evaluate({
            decisionId: "security-1",
            category: "SECURITY",
            evidence: ["customer national id and bank account were exposed"],
            alternatives: ["rotate credentials"],
        });

        expect(result.allowed).toBe(false);
        expect(result.reasons.join(" ")).toMatch(/customer-sensitive/i);
    });

    it("keeps sanitized external packets free of original evidence and context", () => {
        const result = boundary.evaluate({
            decisionId: "architecture-1",
            category: "ARCHITECTURE",
            evidence: ["clean architecture failure signal"],
            alternatives: ["option-a"],
            context: "internal component topology only",
        });

        expect(result.allowed).toBe(true);
        expect(result.sanitized.evidence).toEqual(["[SANITIZED_EXTERNAL_REVIEW_EVIDENCE]"]);
        expect(result.sanitized.context).toBe("[SANITIZED_EXTERNAL_REVIEW_CONTEXT]");
    });
});
