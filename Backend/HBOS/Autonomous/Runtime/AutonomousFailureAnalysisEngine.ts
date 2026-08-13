export interface FailureEvidence {
    issue: string;
    source?: string;
}

export interface RepairCluster {
    id: string;
    rootCause: string;
    repairCapabilityId: string;
    priority: number;
    evidence: string[];
    rationale: string;
}

export interface FailureAnalysisResult {
    status: "repairable" | "unknown";
    clusters: RepairCluster[];
}

/**
 * Converts verification failures into independent, ordered repair missions.
 * It is intentionally deterministic: the same failure evidence produces the
 * same repair ordering, preventing blind retry loops.
 */
export class AutonomousFailureAnalysisEngine {
    analyze(evidence: FailureEvidence[] | string[]): FailureAnalysisResult {
        const normalized = evidence.map(item => typeof item === "string" ? item : `${item.source ?? "verify"}: ${item.issue}`)
            .map(value => value.trim())
            .filter(Boolean);
        const text = normalized.join("\n");
        const clusters: RepairCluster[] = [];

        const add = (cluster: RepairCluster) => {
            if (!clusters.some(existing => existing.id === cluster.id)) clusters.push(cluster);
        };

        if (/FinancialStatementAnalysisService|Cannot find module .*FinancialStatementAnalysisService|financial-statement-analysis/i.test(text)) {
            add({
                id: "product-financial-analysis-import-contract",
                rootCause: "product-test-import-boundary-mismatch",
                repairCapabilityId: "repair-product.financial-statement-analysis",
                priority: 10,
                evidence: normalized.filter(value => /FinancialStatementAnalysisService|financial-statement-analysis/i.test(value)),
                rationale: "The financial statement product test/implementation boundary is inconsistent; repair the canonical product artifact and its focused test together."
            });
        }

        if (/CommercialRuntimeServer|Received: 400|afterAll\(done|done callback and return something/i.test(text)) {
            add({
                id: "commercial-runtime-contract",
                rootCause: "commercial-runtime-request-or-test-lifecycle-contract",
                repairCapabilityId: "repair-commercial-runtime-server",
                priority: 20,
                evidence: normalized.filter(value => /CommercialRuntimeServer|Received: 400|afterAll\(done|done callback and return something/i.test(value)),
                rationale: "The commercial runtime has a request contract failure and/or Jest lifecycle mismatch; repair the runtime boundary and its E2E test as one cluster."
            });
        }

        if (/AutonomousConstructionEngine\.(quality|quality-gate|idempotent)|QUALITY_[A-Z_]+|FINALIZE|idempotent/i.test(text)) {
            add({
                id: "construction-quality-evidence-contract",
                rootCause: "construction-quality-evidence-contract-mismatch",
                repairCapabilityId: "repair-autonomous-construction-quality",
                priority: 30,
                evidence: normalized.filter(value => /AutonomousConstructionEngine\.(quality|quality-gate|idempotent)|QUALITY_[A-Z_]+|FINALIZE|idempotent/i.test(value)),
                rationale: "Construction finalization and quality evidence contracts are inconsistent; repair the construction/quality handshake rather than weakening the gate."
            });
        }

        if (/AutonomousDevelopmentLoop\.repair|repair identity|repair-product\./i.test(text)) {
            add({
                id: "repair-loop-identity",
                rootCause: "repair-capability-identity-or-completion-contract",
                repairCapabilityId: "repair-autonomous-development-loop",
                priority: 40,
                evidence: normalized.filter(value => /AutonomousDevelopmentLoop\.repair|repair identity|repair-product\./i.test(value)),
                rationale: "Repair intent is not being preserved through planning/generation; repair the repair-loop identity contract."
            });
        }

        if (/TS2307|TS2322|TS2550|Cannot find module/i.test(text)) {
            add({
                id: "typescript-contract-integrity",
                rootCause: "typescript-type-or-module-contract-integrity",
                repairCapabilityId: "repair-typescript-contract-integrity",
                priority: 50,
                evidence: normalized.filter(value => /TS2307|TS2322|TS2550|Cannot find module/i.test(value)),
                rationale: "The verification set contains unresolved TypeScript contract errors that require canonical source/import/type repair."
            });
        }

        clusters.sort((a, b) => a.priority - b.priority);
        return { status: clusters.length > 0 ? "repairable" : "unknown", clusters };
    }

    selectNext(evidence: FailureEvidence[] | string[]): RepairCluster | null {
        return this.analyze(evidence).clusters[0] ?? null;
    }
}
