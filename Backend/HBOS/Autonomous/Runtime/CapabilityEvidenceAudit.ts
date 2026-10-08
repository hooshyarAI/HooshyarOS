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
 * The four evidence levels defined by the Commercial Product Completion Contract.
 * Level 1/2 (unit/integration) evidence must never be promoted to commercial
 * completion without level 3 (application) and level 4 (acceptance) evidence.
 */
export type EvidenceLevel = "unit" | "integration" | "application" | "acceptance";

export interface EvidenceLevelStatus {
    present: boolean;
    passed: boolean;
    fresh: boolean;
    blocked?: boolean;
    artifact?: string;
    detail?: string;
}

export interface CompletionEvidence {
    capabilityId: string;
    base: CapabilityEvidence;
    unit?: EvidenceLevelStatus;
    integration?: EvidenceLevelStatus;
    application?: EvidenceLevelStatus;
    acceptance?: EvidenceLevelStatus;
    externalBlocked?: boolean;
}

export interface CompletionEvidenceResult {
    capabilityId: string;
    complete: boolean;
    missing: string[];
    nonCompleteReasons: string[];
}

const EVIDENCE_LEVELS: EvidenceLevel[] = ["unit", "integration", "application", "acceptance"];

/**
 * Method names that appear in focused tests but are not capability behavior.
 * A focused test is only behavioral evidence when it exercises a method that the
 * owning implementation actually defines.
 */
export const NON_BEHAVIORAL_TEST_CALLS = new Set([
    "expect", "toBe", "toEqual", "toContain", "toBeCloseTo", "toBeDefined", "toBeTruthy",
    "toBeFalsy", "toThrow", "toHaveLength", "toMatch", "toMatchObject", "toHaveBeenCalled",
    "toHaveBeenCalledTimes", "toHaveBeenCalledWith", "not", "resolves", "rejects",
    "describe", "it", "test", "beforeEach", "afterEach", "beforeAll", "afterAll",
    "initialize", "health", "describeCapability"
]);

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Proves the focused test actually exercises the owning implementation's behavior.
 * A marker string, a file name or a mere `expect(` is not sufficient on its own:
 * the test must reference a behavior the implementation defines, unless an explicit
 * governed behavior marker is present in both the implementation and the test.
 */
export function behavioralEvidenceSatisfied(implementationSource: string, testSource: string, explicitMarkers: string[] = []): boolean {
    if (!implementationSource || !testSource) return false;
    if (!testSource.includes("expect(")) return false;
    if (explicitMarkers.some(marker => implementationSource.includes(marker) && testSource.includes(marker))) return true;

    const candidates = [...testSource.matchAll(/\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)]
        .map(match => match[1])
        .filter((method): method is string => Boolean(method) && !NON_BEHAVIORAL_TEST_CALLS.has(method));

    return candidates.some(method => new RegExp(`\\b${escapeRegExp(method)}\\s*\\(`).test(implementationSource));
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

    /**
     * Fail-closed completion gate. Completion may only be reported when the
     * presence gate passes and every required evidence level is present, verified,
     * fresh (bound to the current trusted checkpoint) and not blocked.
     * Missing, unverified, stale, contradictory or externally-blocked evidence is
     * never treated as completion.
     */
    evaluateCompletion(evidence: CompletionEvidence): CompletionEvidenceResult {
        const missing = this.evaluate(evidence.base).missing;
        const nonCompleteReasons: string[] = missing.map(item => `base-${item}-missing`);

        if (evidence.externalBlocked) nonCompleteReasons.push("external-dependency-blocked");

        for (const level of EVIDENCE_LEVELS) {
            const status = evidence[level];
            if (!status || !status.present) {
                nonCompleteReasons.push(`${level}-evidence-missing`);
                continue;
            }
            if (status.blocked) {
                nonCompleteReasons.push(`${level}-evidence-blocked`);
                continue;
            }
            if (!status.passed) {
                nonCompleteReasons.push(`${level}-evidence-unverified`);
                continue;
            }
            if (!status.fresh) {
                nonCompleteReasons.push(`${level}-evidence-stale`);
            }
        }

        return {
            capabilityId: evidence.capabilityId,
            complete: nonCompleteReasons.length === 0,
            missing,
            nonCompleteReasons
        };
    }
}
