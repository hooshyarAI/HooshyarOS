import { aggregateCapabilityEvidence } from "./CapabilityEvidenceAggregation";

describe("Capability evidence aggregation", () => {
    it("does not treat an existing artifact as behavioral verification", () => {
        const result = aggregateCapabilityEvidence({
            capability: "Financial Ingestion",
            documented: true,
            artifactPresent: true,
            behavioralVerified: false,
            integrationVerified: false,
            blockers: [],
        });

        expect(result.implementationEvidence).toBe("PRESENT");
        expect(result.verification).toBe("UNVERIFIED");
        expect(result.blockers).toContain("BEHAVIORAL_VERIFICATION_MISSING");
    });

    it("promotes evidence only after behavioral and integration verification", () => {
        const result = aggregateCapabilityEvidence({
            capability: "Financial Ingestion",
            documented: true,
            artifactPresent: true,
            behavioralVerified: true,
            integrationVerified: true,
            blockers: [],
        });

        expect(result.verification).toBe("INTEGRATION_VERIFIED");
    });
});
