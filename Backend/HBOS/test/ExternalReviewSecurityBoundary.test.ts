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

    it("blocks customer-sensitive alternatives before external transmission", () => {
        const result = boundary.evaluate({
            decisionId: "repair-2",
            category: "REPAIR",
            evidence: ["focused runtime failure"],
            alternatives: ["use customer email list to reproduce the issue"],
        });

        expect(result.allowed).toBe(false);
        expect(result.reasons.join(" ")).toMatch(/customer-sensitive/i);
    });

    it("blocks high-risk identifiers even without explicit customer markers", () => {
        const result = boundary.evaluate({
            decisionId: "security-2",
            category: "SECURITY",
            evidence: ["identifier detected"],
            alternatives: ["use 4111111111111111 for reproduction"],
        });

        expect(result.allowed).toBe(false);
        expect(result.reasons.join(" ")).toMatch(/high-risk identifier/i);
    });

    it("blocks categories outside the governed review vocabulary", () => {
        const result = boundary.evaluate({
            decisionId: "review-1",
            category: "CUSTOMER_DATA",
            evidence: ["safe abstraction"],
            alternatives: ["option-a"],
        });

        expect(result.allowed).toBe(false);
        expect(result.reasons.join(" ")).toMatch(/category.*governed/i);
    });

    it("blocks RELEASE because release review is not an approved external-review category", () => {
        const result = boundary.evaluate({
            decisionId: "release-1",
            category: "RELEASE",
            evidence: ["installer artifact verification"],
            alternatives: ["rebuild release artifact"],
        });

        expect(result.allowed).toBe(false);
        expect(result.reasons.join(" ")).toMatch(/category.*governed/i);
    });

    it("blocks malformed decision ids before external transmission", () => {
        const result = boundary.evaluate({
            decisionId: " architecture-1 ",
            category: "ARCHITECTURE",
            evidence: ["clean architecture failure signal"],
            alternatives: ["option-a"],
        });

        expect(result.allowed).toBe(false);
        expect(result.reasons.join(" ")).toMatch(/decision id.*malformed/i);
    });

    it("keeps sanitized external packets free of original decision id, evidence, alternatives and context", () => {
        const result = boundary.evaluate({
            decisionId: "architecture-1",
            category: "ARCHITECTURE",
            evidence: ["clean architecture failure signal"],
            alternatives: ["option-a"],
            context: "internal component topology only",
        });

        expect(result.allowed).toBe(true);
        expect(result.sanitized.decisionId).toBe("[OPAQUE_EXTERNAL_REVIEW_ID]");
        expect(result.sanitized.evidence).toEqual(["[SANITIZED_EXTERNAL_REVIEW_EVIDENCE]"]);
        expect(result.sanitized.alternatives).toEqual(["[SANITIZED_EXTERNAL_REVIEW_ALTERNATIVE]"]);
        expect(result.sanitized.context).toBe("[SANITIZED_EXTERNAL_REVIEW_CONTEXT]");
        expect(JSON.stringify(result.sanitized)).not.toContain("clean architecture failure signal");
        expect(JSON.stringify(result.sanitized)).not.toContain("option-a");
        expect(JSON.stringify(result.sanitized)).not.toContain("architecture-1");
    });
});
