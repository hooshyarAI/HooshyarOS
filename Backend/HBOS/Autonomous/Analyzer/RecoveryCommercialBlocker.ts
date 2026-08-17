import { evaluatePersistenceRecoveryEvidence, PersistenceRecoveryEvidence } from "./PersistenceRecoveryEvidenceGate";

export function evaluateRecoveryCommercialBlocker(evidence: PersistenceRecoveryEvidence): string[] {
    const result = evaluatePersistenceRecoveryEvidence(evidence);
    return result.verified ? [] : ["PERSISTENCE_RECOVERY_NOT_VERIFIED", ...result.blockers];
}
