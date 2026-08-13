export interface QualityEvidence {
    name?: string;
    implementationVerified?: boolean;
    testVerified?: boolean;
    behavioralEvidenceVerified?: boolean;
    integrationVerified?: boolean;
    cleanRepository?: boolean;
}

export interface QualityGateResult {
    component: unknown;
    approved: boolean;
    issues: string[];
}

/**
 * Factory-level quality gate. Approval is fail-closed and requires explicit
 * implementation, test, behavioral, integration and repository evidence.
 */
export class QualityGate {
    check(component: unknown): QualityGateResult {
        const issues: string[] = [];
        if (!component || typeof component !== "object") {
            issues.push("QUALITY_COMPONENT_MISSING");
            return { component, approved: false, issues };
        }

        const evidence = component as QualityEvidence;
        if (!evidence.implementationVerified) issues.push("QUALITY_IMPLEMENTATION_UNVERIFIED");
        if (!evidence.testVerified) issues.push("QUALITY_TEST_UNVERIFIED");
        if (!evidence.behavioralEvidenceVerified) issues.push("QUALITY_BEHAVIOR_UNVERIFIED");
        if (!evidence.integrationVerified) issues.push("QUALITY_INTEGRATION_UNVERIFIED");
        if (!evidence.cleanRepository) issues.push("QUALITY_REPOSITORY_NOT_CLEAN");

        return {
            component,
            approved: issues.length === 0,
            issues
        };
    }
}
