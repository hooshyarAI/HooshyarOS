export interface CapabilityEvidence {
    implementation: boolean;
    test: boolean;
    documentation: boolean;
    dependenciesSatisfied: boolean;
    verified: boolean;
}

export interface CapabilityEvidenceResult extends CapabilityEvidence {
    complete: boolean;
    missing: string[];
}

/**
 * Deterministic evidence gate for autonomous platform capability completion.
 * File existence alone is never sufficient evidence of completion.
 */
export class CapabilityEvidenceAudit {
    evaluate(evidence: CapabilityEvidence): CapabilityEvidenceResult {
        const missing: string[] = [];

        if (!evidence.implementation) missing.push("implementation");
        if (!evidence.test) missing.push("test");
        if (!evidence.documentation) missing.push("documentation");
        if (!evidence.dependenciesSatisfied) missing.push("dependencies");
        if (!evidence.verified) missing.push("verification");

        return {
            ...evidence,
            complete: missing.length === 0,
            missing,
        };
    }
}
