import { QualityGate } from "./QualityGate";

describe("Factory QualityGate", () => {
    it("rejects missing quality evidence", () => {
        const result = new QualityGate().check(null);
        expect(result.approved).toBe(false);
        expect(result.issues).toContain("QUALITY_COMPONENT_MISSING");
    });

    it("rejects incomplete evidence instead of auto-approving", () => {
        const result = new QualityGate().check({ name: "sample" });
        expect(result.approved).toBe(false);
        expect(result.issues.length).toBeGreaterThan(0);
    });

    it("approves only a complete verified quality record", () => {
        const result = new QualityGate().check({
            name: "sample",
            implementationVerified: true,
            testVerified: true,
            behavioralEvidenceVerified: true,
            integrationVerified: true,
            cleanRepository: true
        });
        expect(result.approved).toBe(true);
        expect(result.issues).toEqual([]);
    });
});
