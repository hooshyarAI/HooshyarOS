export interface CapabilityEvidenceState {
    capability: string;
    documented: boolean;
    artifactPresent: boolean;
    behavioralVerified: boolean;
    integrationVerified: boolean;
    blockers: string[];
}

export interface AggregatedCapabilityEvidence {
    capability: string;
    implementationEvidence: "MISSING" | "PRESENT";
    verification: "UNVERIFIED" | "BEHAVIORALLY_VERIFIED" | "INTEGRATION_VERIFIED";
    blockers: string[];
}

export function aggregateCapabilityEvidence(state: CapabilityEvidenceState): AggregatedCapabilityEvidence {
    const blockers = [...state.blockers];
    if (!state.documented) blockers.push("NOT_DOCUMENTED");
    if (!state.artifactPresent) blockers.push("REQUIRED_ARTIFACT_MISSING");
    if (!state.behavioralVerified) blockers.push("BEHAVIORAL_VERIFICATION_MISSING");

    let verification: AggregatedCapabilityEvidence["verification"] = "UNVERIFIED";
    if (state.behavioralVerified) verification = "BEHAVIORALLY_VERIFIED";
    if (state.behavioralVerified && state.integrationVerified) verification = "INTEGRATION_VERIFIED";

    return {
        capability: state.capability,
        implementationEvidence: state.artifactPresent ? "PRESENT" : "MISSING",
        verification,
        blockers,
    };
}
