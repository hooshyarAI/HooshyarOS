export interface PersistenceRecoveryEvidence {
    durableWriteVerified: boolean;
    durableReadAfterRestartVerified: boolean;
    backupArtifactVerified: boolean;
    restoreVerified: boolean;
    integrityVerifiedAfterRestore: boolean;
    recoveryFailureFailsClosed: boolean;
}

export interface PersistenceRecoveryResult {
    verified: boolean;
    blockers: string[];
}

export function evaluatePersistenceRecoveryEvidence(
    evidence: PersistenceRecoveryEvidence,
): PersistenceRecoveryResult {
    const checks: Array<[boolean, string]> = [
        [evidence.durableWriteVerified, "DURABLE_WRITE_NOT_VERIFIED"],
        [evidence.durableReadAfterRestartVerified, "READ_AFTER_RESTART_NOT_VERIFIED"],
        [evidence.backupArtifactVerified, "BACKUP_ARTIFACT_NOT_VERIFIED"],
        [evidence.restoreVerified, "RESTORE_NOT_VERIFIED"],
        [evidence.integrityVerifiedAfterRestore, "POST_RESTORE_INTEGRITY_NOT_VERIFIED"],
        [evidence.recoveryFailureFailsClosed, "RECOVERY_FAILURE_NOT_FAIL_CLOSED"],
    ];
    const blockers = checks.filter(([ok]) => !ok).map(([, reason]) => reason);
    return { verified: blockers.length === 0, blockers };
}
