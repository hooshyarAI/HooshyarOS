import { CapabilityEvidenceAdapter } from "./CapabilityEvidenceAdapter";
import { DiscoveredCapability } from "./CapabilityDiscovery";

describe("CapabilityEvidenceAdapter", () => {
    it("converts verified repository evidence without inventing behavioral verification", () => {
        const discovered: DiscoveredCapability = {
            name: "financial-ingestion",
            missingPaths: [],
            evidence: [
                { stage: "DOCUMENTED", verified: true },
                { stage: "IMPLEMENTED", verified: true },
            ],
        };

        const result = new CapabilityEvidenceAdapter().toGateEvidence(discovered);

        expect(result).toEqual([
            {
                capability: "financial-ingestion",
                stage: "DOCUMENTED",
                evidence: ["repository-discovery"],
            },
            {
                capability: "financial-ingestion",
                stage: "IMPLEMENTED",
                evidence: ["required-artifacts-present"],
            },
        ]);
        expect(result.some((item) => item.stage === "BEHAVIORALLY_VERIFIED")).toBe(false);
    });

    it("does not emit implementation evidence when required artifacts are missing", () => {
        const discovered: DiscoveredCapability = {
            name: "backup",
            missingPaths: ["ops/backup.ts"],
            evidence: [
                { stage: "DOCUMENTED", verified: true },
                { stage: "IMPLEMENTED", verified: false },
            ],
        };

        const result = new CapabilityEvidenceAdapter().toGateEvidence(discovered);

        expect(result).toEqual([
            {
                capability: "backup",
                stage: "DOCUMENTED",
                evidence: ["repository-discovery"],
            },
        ]);
    });
});
