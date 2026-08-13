import { QualityGate } from "../Factory/Quality/QualityGate";

describe("Factory QualityGate", () => {
    const gate = new QualityGate();

    it("rejects missing evidence", () => {
        const result = gate.check({});
        expect(result.approved).toBe(false);
        expect(result.issues).toEqual([
            "QUALITY_IMPLEMENTATION_UNVERIFIED",
            "QUALITY_TEST_UNVERIFIED",
            "QUALITY_BEHAVIOR_UNVERIFIED",
            "QUALITY_INTEGRATION_UNVERIFIED",
            "QUALITY_REPOSITORY_NOT_CLEAN"
        ]);
    });

    it("rejects partial evidence", () => {
        const result = gate.check({
            implementationVerified: true,
            testVerified: true,
            behavioralEvidenceVerified: true,
            integrationVerified: false,
            cleanRepository: true
        });
        expect(result.approved).toBe(false);
        expect(result.issues).toContain("QUALITY_INTEGRATION_UNVERIFIED");
    });

    it("approves only complete evidence", () => {
        const result = gate.check({
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
