import { CapabilityEvidence } from "./CapabilityGateEvaluator";
import { DiscoveredCapability } from "./CapabilityDiscovery";

export class CapabilityEvidenceAdapter {
    toGateEvidence(discovered: DiscoveredCapability): CapabilityEvidence[] {
        return discovered.evidence
            .filter((evidence) => evidence.verified)
            .map((evidence) => ({
                capability: discovered.name,
                stage: evidence.stage,
                evidence: evidence.stage === "IMPLEMENTED"
                    ? discovered.missingPaths.length === 0
                        ? discovered.missingPaths.length === 0
                            ? ["required-artifacts-present"]
                            : []
                        : []
                    : ["repository-discovery"],
            }));
    }
}
