export type ReadinessState = "NOT_VERIFIED" | "VERIFIED";

export interface ProductionReadinessEvidence {
    health: ReadinessState;
    persistence: ReadinessState;
    backupRestore: ReadinessState;
    observability: ReadinessState;
    security: ReadinessState;
    deployment: ReadinessState;
    performance: ReadinessState;
    endToEnd: ReadinessState;
}

export interface ProductionReadinessResult {
    productionVerified: boolean;
    evidence: ProductionReadinessEvidence;
    blockers: string[];
}

export class ProductionReadinessEvidenceEngine {
    evaluate(evidence: ProductionReadinessEvidence): ProductionReadinessResult {
        const blockers = Object.entries(evidence)
            .filter(([, state]) => state !== "VERIFIED")
            .map(([name]) => name);
        return {
            productionVerified: blockers.length === 0,
            evidence,
            blockers,
        };
    }
}
