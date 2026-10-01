/**
 * B-05.1 — governed learning lifecycle owner.
 *
 * Proves the canonical lifecycle
 *   OBSERVATION -> CANDIDATE_LESSON -> EVIDENCE_VALIDATION -> MEASURED_RESULT
 *   -> GOVERNED_PROMOTION -> VERSIONED_ARTIFACT -> CONTROLLED_RETRIEVAL
 *
 * and proves the safety properties that make it usable inside HooshyarOS:
 * tenant isolation identical to B-04, a real governance gate (a VIEWER is
 * genuinely DENIED), no promotion without validated evidence, no promotion
 * without a measured result, versioned artifacts with recoverable history, and
 * rollback that never deletes anything.
 *
 * The service is a product service, not an Engine. These tests also assert that
 * it contains zero financial arithmetic and never touches a canonical insight.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GovernedLearningLifecycle, LearningEvidenceGateError, LearningGovernanceDeniedError, LearningMeasurementRequiredError, LearningObservationEvidenceRequiredError, LearningTenantRequiredError, type LearningCandidate } from "../Product/GovernedLearningLifecycle";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { GovernanceEngine } from "../Engines/GovernanceEngine";
import { SecurityContext } from "../Security/SecurityContext";
import { Principal } from "../Security/Principals";
import { Authorization } from "../Security/Authorization";
import { MemoryEngine } from "../Core/MemoryEngine";

const TENANT = "tenant-a";
const OTHER_TENANT = "tenant-b";

const observationSource = "financial-ingestion:10d44d0f7ae7858d57f61e69aadfd9e32ccca10a4963d84ab34c620f736c5a5f";

const ownerContext = (tenantId = TENANT) =>
    SecurityContext.forHumanUser(Principal.humanUser("user-owner", tenantId), [Authorization.READ, Authorization.WRITE, Authorization.ACCESS_EVIDENCE]);

const viewerContext = (tenantId = TENANT) =>
    SecurityContext.forHumanUser(Principal.humanUser("user-viewer", tenantId), [Authorization.READ]);

describe("B-05.1 GovernedLearningLifecycle", () => {
    let store: SQLitePersistenceStore;
    let lifecycle: GovernedLearningLifecycle;
    let clock: number;

    beforeEach(() => {
        store = new SQLitePersistenceStore({ databasePath: ":memory:" });
        clock = Date.parse("2026-10-01T00:00:00.000Z");
        lifecycle = new GovernedLearningLifecycle(store, new GovernanceEngine(), () => ++clock);
    });

    afterEach(() => {
        store.close();
    });

    const observe = async (overrides: Partial<{ tenantId: string; subject: string; sourceRef: string; observedAt: string }> = {}) =>
        lifecycle.recordObservation({
            tenantId: overrides.tenantId ?? TENANT,
            subject: overrides.subject ?? "liquidity-pressure-response",
            sourceRef: overrides.sourceRef ?? observationSource,
            observedAt: overrides.observedAt ?? "2026-10-01T00:00:00.000Z",
        });

    const candidate = async (statement = "Reducing receivable days measurably improved the current ratio.") => {
        const observation = await observe();
        return lifecycle.createCandidateLesson({ tenantId: TENANT, observationRef: observation.observationId, statement });
    };

    const validated = async (statement?: string) => {
        const created = await candidate(statement);
        return lifecycle.validateEvidence({
            tenantId: TENANT,
            candidateRef: created.candidateId,
            evidence: [{ ref: "integrity-check:balance-sheet-identity", verified: true }],
        });
    };

    const measured = async (statement?: string) => {
        const created = await validated(statement);
        return lifecycle.recordMeasuredResult({
            tenantId: TENANT,
            candidateRef: created.candidateId,
            metric: "currentRatio",
            outcome: "IMPROVED",
            value: 1.8,
        });
    };

    const promoted = async (statement?: string) =>
        lifecycle.promote({ tenantId: TENANT, candidateRef: (await measured(statement)).candidateId, securityContext: ownerContext() });

    // ---------------------------------------------------------------- positive

    it("records a valid observation with real provenance", async () => {
        const observation = await observe();
        expect(observation.tenantId).toBe(TENANT);
        expect(observation.sourceRef).toBe(observationSource);
        expect(observation.observedAt).toBe("2026-10-01T00:00:00.000Z");
        expect(observation.traceId).toMatch(/^TRACE-/);
        expect(observation.provenanceHash).toHaveLength(64);
    });

    it("creates a candidate lesson from a real observation that is not yet valid or promoted", async () => {
        const created = await candidate();
        expect(created.validationState).toBe("UNVALIDATED");
        expect(created.promotionState).toBe("CANDIDATE");
        expect(created.observationRef).toMatch(/^obs-/);
        // A candidate carries no version and no measured outcome of its own.
        expect((created as unknown as { version?: number }).version).toBeUndefined();
        expect(created.measuredResult).toBeNull();
    });

    it("validates evidence explicitly and traceably", async () => {
        const result = await validated();
        expect(result.validationState).toBe("VALIDATED");
        expect(result.evidence).toEqual([{ ref: "integrity-check:balance-sheet-identity", verified: true }]);
        expect(result.updatedAt >= result.createdAt).toBe(true);
    });

    it("records the measured result separately from the observation", async () => {
        const result = await measured();
        expect(result.measuredResult).not.toBeNull();
        expect(result.measuredResult?.metric).toBe("currentRatio");
        expect(result.measuredResult?.value).toBe(1.8);
        // The measurement is its own state with its own timestamp and trace,
        // not the observation reused as its own outcome.
        expect(result.measuredResult?.measuredAt).not.toBe(result.observedAt);
        expect(result.measuredResult?.measuredByTraceId).toMatch(/^TRACE-/);
    });

    it("promotes an authorized, validated, measured candidate and persists its version", async () => {
        const artifact = await promoted();
        expect(artifact.version).toBe(1);
        expect(artifact.validity).toBe("ACTIVE");
        expect(artifact.promotionState).toBe("PROMOTED");
        expect(artifact.validationState).toBe("VALIDATED");
        expect(artifact.tenantId).toBe(TENANT);
        // Persisted, not just returned.
        const persisted = await lifecycle.retrieveVersion(TENANT, artifact.subject, 1);
        expect(persisted?.artifactId).toBe(artifact.artifactId);
    });

    it("carries complete provenance on every promoted artifact", async () => {
        const artifact = await promoted();
        expect(artifact.tenantId).toBe(TENANT);
        expect(artifact.traceId).toMatch(/^TRACE-/);
        expect(artifact.observedAt).toBe("2026-10-01T00:00:00.000Z");
        expect(artifact.sourceRef).toBe(observationSource);
        expect(artifact.evidenceRef).toBe("integrity-check:balance-sheet-identity");
        expect(artifact.observationRef).toMatch(/^obs-/);
        expect(artifact.candidateRef).toMatch(/^cand-/);
        expect(artifact.validationState).toBe("VALIDATED");
        expect(artifact.promotionState).toBe("PROMOTED");
        expect(artifact.measuredResult?.metric).toBe("currentRatio");
        expect(artifact.version).toBe(1);
        expect(artifact.validity).toBe("ACTIVE");
        expect(artifact.provenance.createdAt).toBe(artifact.provenance.createdAt);
        expect(artifact.provenance.createdByTraceId).toMatch(/^TRACE-/);
        expect(artifact.provenance.inputHash).toHaveLength(64);
        expect(artifact.provenance.outputHash).toHaveLength(64);
    });

    it("increments the version on a second promotion and keeps the previous version recoverable", async () => {
        const first = await promoted();
        const second = await promoted("Extending the collection cycle to 45 days reduced overdue balances.");
        expect(second.version).toBe(2);
        expect(second.supersededVersion).toBe(1);
        expect(second.divergences).toHaveLength(1);
        expect(second.divergences[0].resolution).toBe("SEPARATE_VERSION_PRESERVED");

        // The old version still exists, marked SUPERSEDED rather than deleted.
        const previous = await lifecycle.retrieveVersion(TENANT, first.subject, 1);
        expect(previous).not.toBeNull();
        expect(previous?.artifactId).toBe(first.artifactId);
        expect(previous?.validity).toBe("SUPERSEDED");
        const history = await lifecycle.versionHistory(TENANT, first.subject);
        expect(history.map((entry) => entry.version)).toEqual([2, 1]);
    });

    // ---------------------------------------------------------------- negative

    it("rejects every lifecycle operation without a tenant (fail closed)", async () => {
        await expect(lifecycle.recordObservation({ tenantId: "   ", subject: "s", sourceRef: observationSource, observedAt: "2026-10-01T00:00:00.000Z" })).rejects.toBeInstanceOf(LearningTenantRequiredError);
        await expect(lifecycle.createCandidateLesson({ tenantId: "", observationRef: "obs-x", statement: "s" })).rejects.toBeInstanceOf(LearningTenantRequiredError);
        await expect(lifecycle.validateEvidence({ tenantId: "", candidateRef: "cand-x", evidence: [] })).rejects.toBeInstanceOf(LearningTenantRequiredError);
        await expect(lifecycle.recordMeasuredResult({ tenantId: "", candidateRef: "cand-x", metric: "m", outcome: "o", value: 1 })).rejects.toBeInstanceOf(LearningTenantRequiredError);
        await expect(lifecycle.promote({ tenantId: "", candidateRef: "cand-x", securityContext: ownerContext() })).rejects.toBeInstanceOf(LearningTenantRequiredError);
        await expect(lifecycle.retrieve({ tenantId: "" })).rejects.toBeInstanceOf(LearningTenantRequiredError);
        await expect(lifecycle.retrieveVersion("   ", "s", 1)).rejects.toBeInstanceOf(LearningTenantRequiredError);
        await expect(lifecycle.versionHistory("", "s")).rejects.toBeInstanceOf(LearningTenantRequiredError);
        await expect(lifecycle.inspect("", "s")).rejects.toBeInstanceOf(LearningTenantRequiredError);
        await expect(lifecycle.rollback({ tenantId: "", subject: "s", version: 1, securityContext: ownerContext() })).rejects.toBeInstanceOf(LearningTenantRequiredError);
    });

    it("never lets one tenant observe another tenant's learning", async () => {
        const artifact = await promoted();
        // The other tenant sees nothing at all.
        expect(await lifecycle.retrieve({ tenantId: OTHER_TENANT })).toEqual([]);
        expect(await lifecycle.retrieve({ tenantId: OTHER_TENANT, subject: artifact.subject })).toEqual([]);
        expect(await lifecycle.versionHistory(OTHER_TENANT, artifact.subject)).toEqual([]);
        expect(await lifecycle.inspect(OTHER_TENANT, artifact.subject)).toEqual([]);
        expect(await lifecycle.retrieveVersion(OTHER_TENANT, artifact.subject, 1)).toBeNull();
        // And cannot reach the candidate either.
        await expect(lifecycle.inspectCandidate(OTHER_TENANT, artifact.candidateRef)).rejects.toThrow(/not-found/);
        // The owner still sees exactly its own single artifact.
        const own = await lifecycle.retrieve({ tenantId: TENANT });
        expect(own).toHaveLength(1);
        expect(own[0].tenantId).toBe(TENANT);
    });

    it("refuses an observation that cites no real source", async () => {
        await expect(lifecycle.recordObservation({ tenantId: TENANT, subject: "s", sourceRef: "  ", observedAt: "2026-10-01T00:00:00.000Z" })).rejects.toBeInstanceOf(LearningObservationEvidenceRequiredError);
    });

    it("blocks promotion when evidence is missing", async () => {
        const created = await candidate();
        const unvalidated = await lifecycle.validateEvidence({ tenantId: TENANT, candidateRef: created.candidateId, evidence: [] });
        expect(unvalidated.validationState).toBe("INVALID");
        await lifecycle.recordMeasuredResult({ tenantId: TENANT, candidateRef: created.candidateId, metric: "currentRatio", outcome: "IMPROVED", value: 1.8 });
        await expect(lifecycle.promote({ tenantId: TENANT, candidateRef: created.candidateId, securityContext: ownerContext() }))
            .rejects.toBeInstanceOf(LearningEvidenceGateError);
        expect(await lifecycle.retrieve({ tenantId: TENANT })).toEqual([]);
    });

    it("blocks promotion when the supplied evidence is not verified", async () => {
        const created = await candidate();
        const invalid = await lifecycle.validateEvidence({
            tenantId: TENANT,
            candidateRef: created.candidateId,
            evidence: [{ ref: "unverified-hypothesis", verified: false }],
        });
        expect(invalid.validationState).toBe("INVALID");
        await lifecycle.recordMeasuredResult({ tenantId: TENANT, candidateRef: created.candidateId, metric: "currentRatio", outcome: "IMPROVED", value: 1.8 });
        await expect(lifecycle.promote({ tenantId: TENANT, candidateRef: created.candidateId, securityContext: ownerContext() }))
            .rejects.toBeInstanceOf(LearningEvidenceGateError);
        expect(await lifecycle.retrieve({ tenantId: TENANT })).toEqual([]);
    });

    it("blocks promotion when no measured result exists, even with valid evidence", async () => {
        const created = await validated();
        expect(created.validationState).toBe("VALIDATED");
        expect(created.measuredResult).toBeNull();
        await expect(lifecycle.promote({ tenantId: TENANT, candidateRef: created.candidateId, securityContext: ownerContext() }))
            .rejects.toBeInstanceOf(LearningMeasurementRequiredError);
        expect(await lifecycle.retrieve({ tenantId: TENANT })).toEqual([]);
    });

    it("blocks promotion of a candidate whose validation was never run", async () => {
        const created = await candidate();
        expect(created.validationState).toBe("UNVALIDATED");
        await lifecycle.recordMeasuredResult({ tenantId: TENANT, candidateRef: created.candidateId, metric: "currentRatio", outcome: "IMPROVED", value: 1.8 });
        await expect(lifecycle.promote({ tenantId: TENANT, candidateRef: created.candidateId, securityContext: ownerContext() }))
            .rejects.toBeInstanceOf(LearningEvidenceGateError);
    });

    it("denies a VIEWER promotion through the real GovernanceEngine", async () => {
        const created = await measured();
        await expect(lifecycle.promote({ tenantId: TENANT, candidateRef: created.candidateId, securityContext: viewerContext() }))
            .rejects.toBeInstanceOf(LearningGovernanceDeniedError);
        // Denied means denied: nothing became active.
        expect(await lifecycle.retrieve({ tenantId: TENANT })).toEqual([]);
        expect(await lifecycle.versionHistory(TENANT, created.subject)).toEqual([]);
        // The same candidate promotes fine for an authorized writer.
        const artifact = await lifecycle.promote({ tenantId: TENANT, candidateRef: created.candidateId, securityContext: ownerContext() });
        expect(artifact.promotionState).toBe("PROMOTED");
        expect(artifact.promotedBy).toBe("user-owner");
    });

    it("denies a cross-tenant promotion attempt", async () => {
        const created = await measured();
        await expect(lifecycle.promote({ tenantId: TENANT, candidateRef: created.candidateId, securityContext: ownerContext(OTHER_TENANT) }))
            .rejects.toBeInstanceOf(LearningGovernanceDeniedError);
        expect(await lifecycle.retrieve({ tenantId: TENANT })).toEqual([]);
    });

    it("excludes the superseded version from active retrieval", async () => {
        await promoted();
        await promoted("Extending the collection cycle to 45 days reduced overdue balances.");
        const active = await lifecycle.retrieve({ tenantId: TENANT });
        expect(active).toHaveLength(1);
        expect(active[0].version).toBe(2);
        expect(active[0].validity).toBe("ACTIVE");
        // Both versions remain retrievable explicitly.
        expect((await lifecycle.versionHistory(TENANT, active[0].subject)).map((e) => e.validity)).toEqual(["ACTIVE", "SUPERSEDED"]);
    });

    it("rolls back to a previous version without deleting any history", async () => {
        const first = await promoted();
        const second = await promoted("Extending the collection cycle to 45 days reduced overdue balances.");
        expect(second.version).toBe(2);

        const restored = await lifecycle.rollback({ tenantId: TENANT, subject: first.subject, version: 1, securityContext: ownerContext() });
        expect(restored.version).toBe(1);
        expect(restored.validity).toBe("ACTIVE");
        expect(restored.provenance.updatedByTraceId).toMatch(/^TRACE-/);

        // Active retrieval now returns version 1 only.
        const active = await lifecycle.retrieve({ tenantId: TENANT });
        expect(active.map((e) => e.version)).toEqual([1]);
        // Nothing was deleted: both versions still exist.
        const history = await lifecycle.versionHistory(TENANT, first.subject);
        expect(history.map((e) => e.version).sort()).toEqual([1, 2]);
        expect((await lifecycle.retrieveVersion(TENANT, first.subject, 2))?.validity).toBe("SUPERSEDED");
        // The rollback is auditable through inspect().
        const states = await lifecycle.inspect(TENANT, first.subject);
        expect(states).toHaveLength(2);
        expect(states.find((s) => s.version === 1)?.validity).toBe("ACTIVE");
    });

    it("refuses a rollback to a version that does not exist", async () => {
        await promoted();
        await expect(lifecycle.rollback({ tenantId: TENANT, subject: "liquidity-pressure-response", version: 7, securityContext: ownerContext() }))
            .rejects.toThrow(/not-found/);
    });

    it("exposes candidate lifecycle state without granting it artifact status", async () => {
        const created = await measured();
        const inspected: LearningCandidate | null = await lifecycle.inspectCandidate(TENANT, created.candidateId);
        expect(inspected?.promotionState).toBe("CANDIDATE");
        expect(inspected?.validationState).toBe("VALIDATED");
        expect(inspected?.measuredResult?.outcome).toBe("IMPROVED");
    });

    // ------------------------------------------------------ architecture limits

    it("is a product service, not a sixth canonical intelligence engine", () => {
        expect(lifecycle).not.toBeInstanceOf(MemoryEngine);
        expect(typeof (lifecycle as unknown as { name?: string }).name).toBe("undefined");
    });

    it("contains no financial arithmetic and no canonical insight dependency", () => {
        const source = readFileSync(join(__dirname, "..", "Product", "GovernedLearningLifecycle.ts"), "utf8");
        // Strip comments and template strings so explanatory prose cannot mask code.
        const code = source
            .replace(/\/\*[\s\S]*?\*\//g, " ")
            .replace(/\/\/[^\n]*/g, " ")
            .replace(/`(?:[^`\\]|\\.)*`/g, '""');
        expect(code).not.toMatch(/FinancialStatementInsight/);
        expect(code).not.toMatch(/FinancialIntelligenceEngine/);
        // No arithmetic on financial quantities: only lifecycle counters.
        expect(code).not.toMatch(/\*\s*(revenue|profit|assets|liabilities|margin|ratio)/i);
        expect(code).not.toMatch(/\b(Math\.(round|sqrt|pow|log|exp)\s*\()/);
    });
});
