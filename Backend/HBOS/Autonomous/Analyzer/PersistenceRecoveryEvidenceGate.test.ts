import { evaluatePersistenceRecoveryEvidence } from "./PersistenceRecoveryEvidenceGate";

const complete = {
    durableWriteVerified: true,
    durableReadAfterRestartVerified: true,
    backupArtifactVerified: true,
    restoreVerified: true,
    integrityVerifiedAfterRestore: true,
    recoveryFailureFailsClosed: true,
};

describe("Persistence recovery evidence gate", () => {
    it("passes only with complete persistence and recovery evidence", () => {
        expect(evaluatePersistenceRecoveryEvidence(complete)).toEqual({ verified: true, blockers: [] });
    });

    it("blocks when data is not durable across restart", () => {
        const result = evaluatePersistenceRecoveryEvidence({ ...complete, durableReadAfterRestartVerified: false });
        expect(result.blockers).toContain("READ_AFTER_RESTART_NOT_VERIFIED");
    });

    it("blocks when restored integrity is unverified", () => {
        const result = evaluatePersistenceRecoveryEvidence({ ...complete, integrityVerifiedAfterRestore: false });
        expect(result.blockers).toContain("POST_RESTORE_INTEGRITY_NOT_VERIFIED");
    });
});
