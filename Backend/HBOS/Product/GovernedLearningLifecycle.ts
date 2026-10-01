/**
 * product.governed-learning-lifecycle — B-05 canonical governed learning lifecycle.
 *
 * This is the single canonical product learning owner for HooshyarOS. It is a
 * PRODUCT SERVICE, not an Engine: it creates no sixth canonical intelligence
 * engine and holds no domain logic of its own. It composes existing canonical
 * authorities only:
 *
 *   - `SQLitePersistenceStore` is the durable boundary. This service adds no
 *     second database abstraction.
 *   - `GovernanceEngine` is the promotion authority. Every promotion is a real
 *     `evaluate()` call with `action: "CREATE_RESOURCE"`; approval is never
 *     assumed, synthesised or defaulted.
 *   - `MemoryEvent.validity` supplies the existing ACTIVE / SUPERSEDED / EXPIRED
 *     lifecycle vocabulary instead of a second vocabulary.
 *   - `MemoryEngine` stays contextual memory only. It is NOT the learning owner,
 *     its records are not learning artifacts, and none of its tenant checks are
 *     bypassed or re-implemented here.
 *
 * Lifecycle:
 *
 *   OBSERVATION
 *     -> CANDIDATE_LESSON
 *     -> EVIDENCE_VALIDATION
 *     -> MEASURED_RESULT
 *     -> GOVERNED_PROMOTION
 *     -> VERSIONED_ARTIFACT
 *     -> CONTROLLED_RETRIEVAL
 *
 * Invariants:
 *   - Tenant discipline mirrors B-04. A blank tenant fails closed; a record whose
 *     owner contradicts the requesting tenant fails closed; a tenant can never
 *     observe another tenant's learning.
 *   - ZERO financial arithmetic. This service never computes, derives, adjusts or
 *     mutates a canonical financial value, and never touches
 *     `FinancialStatementInsight`.
 *   - A candidate lesson is not a learning artifact. Only a governed promotion of
 *     a VALIDATED, MEASURED candidate becomes an artifact.
 *   - Measurement is a separate lifecycle state from the observation. The
 *     originating observation is never reused as its own measured outcome.
 *   - Promotion never overwrites or deletes a prior version. The previous active
 *     version becomes SUPERSEDED and stays persisted and retrievable.
 *   - Contradictory lessons are never silently merged: a promoting version that
 *     diverges from the prior active version records the divergence explicitly.
 */
import { ProvenanceTrace } from "../Core/ProvenanceTrace";
import type { MemoryValidity as LearningValidity } from "../Entities/MemoryEvent";
import type { GovernanceEngine } from "../Engines/GovernanceEngine";
import type { SecurityContext } from "../Security/SecurityContext";
import type { SQLitePersistenceStore } from "./SQLitePersistenceStore";

export type { LearningValidity };

/** Evidence-validation state of a candidate lesson. */
export type LearningValidationState = "UNVALIDATED" | "VALIDATED" | "INVALID";

/** Promotion state of a candidate lesson / artifact. */
export type LearningPromotionState = "CANDIDATE" | "PROMOTED" | "REJECTED" | "SUPERSEDED";

/** Thrown when a learning operation is attempted without an explicit tenant. Fails closed. */
export class LearningTenantRequiredError extends Error {
    constructor() {
        super("learning-tenant-required: an explicit tenantId is required for every governed learning operation");
        this.name = "LearningTenantRequiredError";
    }
}

/** Thrown when a persisted learning record's owner contradicts the requesting tenant. Fails closed. */
export class LearningTenantConflictError extends Error {
    constructor(requestedTenantId: string, ownedTenantId: string) {
        super(`learning-tenant-conflict: tenant "${requestedTenantId}" may not access learning owned by "${ownedTenantId}"`);
        this.name = "LearningTenantConflictError";
    }
}

/** Thrown when a referenced observation or candidate does not exist for the tenant. */
export class LearningRecordNotFoundError extends Error {
    constructor(kind: "observation" | "candidate" | "artifact", reference: string) {
        super(`learning-${kind}-not-found: no ${kind} "${reference}" exists in this tenant scope`);
        this.name = "LearningRecordNotFoundError";
    }
}

/** Thrown when an observation is recorded without real evidence of what was observed. */
export class LearningObservationEvidenceRequiredError extends Error {
    constructor() {
        super("learning-observation-evidence-required: an observation must reference the real source that produced it");
        this.name = "LearningObservationEvidenceRequiredError";
    }
}

/** Thrown when promotion is attempted before the evidence gate is satisfied. */
export class LearningEvidenceGateError extends Error {
    constructor(candidateId: string, validationState: LearningValidationState) {
        super(`learning-evidence-gate: candidate "${candidateId}" is ${validationState}; only a VALIDATED candidate can be promoted`);
        this.name = "LearningEvidenceGateError";
    }
}

/** Thrown when promotion is attempted before a measured result exists. */
export class LearningMeasurementRequiredError extends Error {
    constructor(candidateId: string) {
        super(`learning-measurement-required: candidate "${candidateId}" has no measured result; the observation is not its own outcome`);
        this.name = "LearningMeasurementRequiredError";
    }
}

/** Thrown when GovernanceEngine does not ALLOW the promotion. */
export class LearningGovernanceDeniedError extends Error {
    constructor(candidateId: string, status: string, reason: string) {
        super(`learning-governance-denied: promotion of "${candidateId}" is ${status} — ${reason}`);
        this.name = "LearningGovernanceDeniedError";
    }
}

/** A real, observed event that may justify a candidate lesson. */
export interface LearningObservation {
    readonly observationId: string;
    readonly tenantId: string;
    /** What was observed, in plain terms. Never invented by this service. */
    readonly subject: string;
    /** The real source that produced the observation. */
    readonly sourceRef: string;
    readonly observedAt: string;
    readonly traceId: string;
    readonly provenanceHash: string;
}

/** One piece of evidence offered in support of a candidate lesson. */
export interface LearningEvidenceRef {
    readonly ref: string;
    readonly verified: boolean;
    readonly note?: string;
}

/** A measured outcome, recorded separately from the observation that prompted it. */
export interface LearningMeasuredResult {
    readonly measuredAt: string;
    readonly metric: string;
    readonly outcome: string;
    readonly value: number;
    readonly measuredByTraceId: string;
}

/** A candidate lesson: NOT an artifact until governance promotes it. */
export interface LearningCandidate {
    readonly candidateId: string;
    readonly tenantId: string;
    readonly observationRef: string;
    readonly subject: string;
    readonly statement: string;
    readonly sourceRef: string;
    readonly observedAt: string;
    readonly traceId: string;
    readonly validationState: LearningValidationState;
    readonly promotionState: LearningPromotionState;
    readonly evidence: readonly LearningEvidenceRef[];
    /** null until a measured outcome is recorded separately from the observation. */
    readonly measuredResult: LearningMeasuredResult | null;
    readonly createdAt: string;
    readonly updatedAt: string;
}

/** A preserved divergence between a promoting version and the prior active version. */
export interface LearningDivergence {
    readonly previousVersion: number;
    readonly previousArtifactId: string;
    readonly previousStatementHash: string;
    readonly statementHash: string;
    readonly resolution: "SEPARATE_VERSION_PRESERVED";
    readonly note: string;
}

export interface LearningArtifactProvenance {
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly createdByTraceId: string;
    readonly updatedByTraceId: string;
    readonly inputHash: string;
    readonly outputHash: string;
}

/** A governed, versioned learning artifact. */
export interface LearningArtifact {
    readonly artifactId: string;
    readonly tenantId: string;
    readonly subject: string;
    readonly statement: string;
    readonly statementHash: string;
    readonly version: number;
    readonly validity: LearningValidity;
    readonly promotionState: LearningPromotionState;
    readonly validationState: LearningValidationState;
    readonly observationRef: string;
    readonly candidateRef: string;
    readonly evidence: readonly LearningEvidenceRef[];
    readonly evidenceRef: string;
    readonly sourceRef: string;
    readonly observedAt: string;
    readonly measuredResult: LearningMeasuredResult;
    readonly traceId: string;
    readonly promotedBy: string;
    readonly governanceDecision: string;
    readonly supersededVersion: number | null;
    readonly divergences: readonly LearningDivergence[];
    readonly provenance: LearningArtifactProvenance;
}

/** Provenance/version state inspectable without retrieving the artifact body. */
export interface LearningArtifactState {
    readonly artifactId: string;
    readonly subject: string;
    readonly version: number;
    readonly validity: LearningValidity;
    readonly promotionState: LearningPromotionState;
    readonly validationState: LearningValidationState;
    readonly observedAt: string;
    readonly createdAt: string;
    readonly updatedAt: string;
}

export interface RecordObservationInput {
    readonly tenantId: string;
    readonly subject: string;
    /** The real source that produced the observation (evidence reference). */
    readonly sourceRef: string;
    readonly observedAt: string;
    readonly traceId?: string;
}

export interface CreateCandidateLessonInput {
    readonly tenantId: string;
    readonly observationRef: string;
    readonly statement: string;
    readonly traceId?: string;
}

export interface ValidateEvidenceInput {
    readonly tenantId: string;
    readonly candidateRef: string;
    readonly evidence: readonly LearningEvidenceRef[];
    readonly traceId?: string;
}

export interface RecordMeasuredResultInput {
    readonly tenantId: string;
    readonly candidateRef: string;
    readonly metric: string;
    readonly outcome: string;
    readonly value: number;
    readonly traceId?: string;
}

export interface PromoteInput {
    readonly tenantId: string;
    readonly candidateRef: string;
    /** Real caller identity; promotion is refused without it. */
    readonly securityContext: SecurityContext;
    readonly traceId?: string;
}

export interface RetrieveInput {
    readonly tenantId: string;
    /** Optional subject filter. Omitting it returns every active artifact of the tenant. */
    readonly subject?: string;
}

export interface RollbackInput {
    readonly tenantId: string;
    readonly subject: string;
    /** The version to make active again. It must already exist and must not be deleted. */
    readonly version: number;
    readonly securityContext: SecurityContext;
    readonly traceId?: string;
}

/** Per-subject version bookkeeping kept in the canonical persistence store. */
interface SubjectLedger {
    readonly tenantId: string;
    readonly subject: string;
    readonly versions: readonly number[];
    readonly activeVersion: number | null;
}

const OBSERVATION_PREFIX = "learning:observation:";
const CANDIDATE_PREFIX = "learning:candidate:";
const ARTIFACT_PREFIX = "learning:artifact:";
const LEDGER_PREFIX = "learning:ledger:";

const normalizeScope = (value?: string): string => {
    if (typeof value !== "string") return "";
    return value.trim();
};

const requireScope = (value?: string): string => {
    const scope = normalizeScope(value);
    if (!scope) throw new LearningTenantRequiredError();
    return scope;
};

const requireText = (value: unknown): string => {
    return typeof value === "string" ? value.trim() : "";
};

const subjectSlug = (subject: string): string => {
    const slug = subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return slug.length > 0 ? slug : "subject";
};

const observationKey = (tenantId: string, observationId: string): string =>
    `${OBSERVATION_PREFIX}${tenantId}:${observationId}`;

const candidateKey = (tenantId: string, candidateId: string): string =>
    `${CANDIDATE_PREFIX}${tenantId}:${candidateId}`;

const artifactKey = (tenantId: string, subject: string, version: number): string =>
    `${ARTIFACT_PREFIX}${tenantId}:${subjectSlug(subject)}:v${version}`;

const ledgerKey = (tenantId: string, subject: string): string =>
    `${LEDGER_PREFIX}${tenantId}:${subjectSlug(subject)}`;

const statementHash = (statement: string): string => ProvenanceTrace.hashInput(statement);

/**
 * Deterministic artifact identity from its real content. It never encodes a
 * tenant into another tenant's namespace because the caller has already been
 * tenant-scoped by the persistence store and re-verified below.
 */
const artifactId = (tenantId: string, subject: string, version: number, statement: string, traceId: string): string => {
    const digest = ProvenanceTrace.hashInput(`${tenantId}|${subject}|${version}|${statement}`);
    return `learn-${subjectSlug(subject)}-v${version}-${digest.slice(0, 12)}`;
};

export class GovernedLearningLifecycle {
    private readonly persistence: SQLitePersistenceStore;
    private readonly governance: GovernanceEngine;
    private readonly now: () => number;

    constructor(persistence: SQLitePersistenceStore, governance: GovernanceEngine, now: () => number = () => Date.now()) {
        this.persistence = persistence;
        this.governance = governance;
        this.now = now;
    }

    /**
     * OBSERVATION. Records what was actually observed, together with the real
     * source that produced it. An observation without a source reference is not
     * an observation; it is a fabrication, so it is refused.
     */
    async recordObservation(input: RecordObservationInput): Promise<LearningObservation> {
        const tenantId = requireScope(input?.tenantId);
        const subject = requireText(input?.subject);
        const sourceRef = requireText(input?.sourceRef);
        const observedAt = requireText(input?.observedAt);
        if (!subject) throw new Error("learning-observation-subject-required");
        if (!sourceRef) throw new LearningObservationEvidenceRequiredError();
        if (!observedAt) throw new Error("learning-observation-observed-at-required");

        const observation: LearningObservation = Object.freeze({
            observationId: `obs-${this.now()}-${ProvenanceTrace.hashInput(`${tenantId}|${subject}|${observedAt}|${sourceRef}`).slice(0, 12)}`,
            tenantId,
            subject,
            sourceRef,
            observedAt,
            traceId: requireText(input?.traceId) || ProvenanceTrace.createTraceId(),
            provenanceHash: ProvenanceTrace.hashInput(`${tenantId}|${subject}|${sourceRef}|${observedAt}`),
        });
        await this.persistence.write({ tenantId }, observationKey(tenantId, observation.observationId), observation);
        return observation;
    }

    /**
     * CANDIDATE_LESSON. A lesson proposed from one real observation. It carries
     * no validity and no authority until it is validated and promoted.
     */
    async createCandidateLesson(input: CreateCandidateLessonInput): Promise<LearningCandidate> {
        const tenantId = requireScope(input?.tenantId);
        const observationRef = requireText(input?.observationRef);
        const statement = requireText(input?.statement);
        if (!observationRef) throw new Error("learning-candidate-observation-required");
        if (!statement) throw new Error("learning-candidate-statement-required");

        const observation = await this.readOwned(tenantId, OBSERVATION_PREFIX, observationRef, "observation") as LearningObservation | null;
        if (!observation) throw new LearningRecordNotFoundError("observation", observationRef);

        const at = new Date(this.now()).toISOString();
        const candidate: LearningCandidate = Object.freeze({
            candidateId: `cand-${this.now()}-${ProvenanceTrace.hashInput(`${observationRef}|${statement}`).slice(0, 12)}`,
            tenantId,
            observationRef,
            subject: observation.subject,
            statement,
            sourceRef: observation.sourceRef,
            observedAt: observation.observedAt,
            traceId: requireText(input?.traceId) || observation.traceId,
            validationState: "UNVALIDATED" as LearningValidationState,
            promotionState: "CANDIDATE" as LearningPromotionState,
            evidence: Object.freeze([] as LearningEvidenceRef[]),
            measuredResult: null,
            createdAt: at,
            updatedAt: at,
        });
        await this.persistence.write({ tenantId }, candidateKey(tenantId, candidate.candidateId), candidate);
        return candidate;
    }

    /**
     * EVIDENCE_VALIDATION. Explicit and traceable: the caller states which
     * references support the lesson and whether each one verified. No evidence,
     * or any unverified evidence, leaves the candidate INVALID and therefore
     * unpromotable.
     */
    async validateEvidence(input: ValidateEvidenceInput): Promise<LearningCandidate> {
        const tenantId = requireScope(input?.tenantId);
        const candidateRef = requireText(input?.candidateRef);
        const candidate = await this.readCandidate(tenantId, candidateRef);
        const evidence = (input?.evidence ?? []).map((item) => Object.freeze({
            ref: requireText(item?.ref),
            verified: item?.verified === true,
            ...(requireText(item?.note) ? { note: requireText(item?.note) } : {}),
        })).filter((item) => item.ref.length > 0);

        const verified = evidence.length > 0 && evidence.every((item) => item.verified);
        const next: LearningCandidate = Object.freeze({
            ...candidate,
            evidence: Object.freeze(evidence),
            validationState: verified ? ("VALIDATED" as LearningValidationState) : ("INVALID" as LearningValidationState),
            updatedAt: new Date(this.now()).toISOString(),
        });
        await this.persistence.write({ tenantId }, candidateKey(tenantId, candidate.candidateId), next);
        return next;
    }

    /**
     * MEASURED_RESULT. A separate lifecycle state: the outcome is measured from
     * the observation, and it is never inferred from the observation itself.
     */
    async recordMeasuredResult(input: RecordMeasuredResultInput): Promise<LearningCandidate> {
        const tenantId = requireScope(input?.tenantId);
        const candidateRef = requireText(input?.candidateRef);
        const candidate = await this.readCandidate(tenantId, candidateRef);
        const metric = requireText(input?.metric);
        const outcome = requireText(input?.outcome);
        if (!metric) throw new Error("learning-measurement-metric-required");
        if (!outcome) throw new Error("learning-measurement-outcome-required");
        if (typeof input?.value !== "number" || !Number.isFinite(input.value)) {
            throw new Error("learning-measurement-value-required");
        }

        const next: LearningCandidate = Object.freeze({
            ...candidate,
            measuredResult: Object.freeze({
                measuredAt: new Date(this.now()).toISOString(),
                metric,
                outcome,
                value: input.value,
                measuredByTraceId: requireText(input?.traceId) || ProvenanceTrace.createTraceId(),
            }),
            updatedAt: new Date(this.now()).toISOString(),
        });
        await this.persistence.write({ tenantId }, candidateKey(tenantId, candidate.candidateId), next);
        return next;
    }

    /**
     * GOVERNED_PROMOTION -> VERSIONED_ARTIFACT.
     *
     * Every gate is checked in order and each refusal is explicit:
     *   1. the candidate exists in this tenant;
     *   2. its evidence gate is VALIDATED;
     *   3. a measured result exists separately from the observation;
     *   4. `GovernanceEngine.evaluate()` returns ALLOWED for CREATE_RESOURCE.
     *
     * A successful promotion appends a new version. The previously active version
     * is marked SUPERSEDED and remains persisted and retrievable; nothing is
     * deleted or overwritten.
     */
    async promote(input: PromoteInput): Promise<LearningArtifact> {
        const tenantId = requireScope(input?.tenantId);
        const candidateRef = requireText(input?.candidateRef);
        const candidate = await this.readCandidate(tenantId, candidateRef);
        const traceId = requireText(input?.traceId) || candidate.traceId;

        if (candidate.validationState !== "VALIDATED") {
            throw new LearningEvidenceGateError(candidate.candidateId, candidate.validationState);
        }
        if (!candidate.measuredResult) {
            throw new LearningMeasurementRequiredError(candidate.candidateId);
        }
        const securityContext = input?.securityContext;
        if (!securityContext) throw new Error("learning-security-context-required: promotion requires a real security context");

        const governance = this.governance.evaluate({
            action: "CREATE_RESOURCE",
            securityContext,
            target: { tenantId },
            parameters: {
                capabilityId: "product.governed-learning",
                kind: "learning-artifact",
                subject: candidate.subject,
                candidateRef: candidate.candidateId,
            },
            traceId,
        });
        if (governance.status !== "ALLOWED") {
            throw new LearningGovernanceDeniedError(candidate.candidateId, governance.status, governance.reasons.join("; ") || governance.decision);
        }

        const ledger = await this.readLedger(tenantId, candidate.subject);
        const version = (ledger.versions.length > 0 ? Math.max(...ledger.versions) : 0) + 1;
        const previous = ledger.activeVersion === null
            ? null
            : await this.readArtifactByVersion(tenantId, candidate.subject, ledger.activeVersion);
        const now = new Date(this.now()).toISOString();
        const hash = statementHash(candidate.statement);

        // Preserve a contradiction instead of merging it away.
        const divergences: readonly LearningDivergence[] = previous
            ? previous.statementHash === hash
                ? previous.divergences
                : [...previous.divergences, Object.freeze({
                    previousVersion: previous.version,
                    previousArtifactId: previous.artifactId,
                    previousStatementHash: previous.statementHash,
                    statementHash: hash,
                    resolution: "SEPARATE_VERSION_PRESERVED" as const,
                    note: "the promoting lesson diverges from the prior active version; both are preserved as separate versions",
                })]
            : [];

        const artifact: LearningArtifact = Object.freeze({
            artifactId: artifactId(tenantId, candidate.subject, version, candidate.statement, traceId),
            tenantId,
            subject: candidate.subject,
            statement: candidate.statement,
            statementHash: hash,
            version,
            validity: "ACTIVE" as LearningValidity,
            promotionState: "PROMOTED" as LearningPromotionState,
            validationState: candidate.validationState,
            observationRef: candidate.observationRef,
            candidateRef: candidate.candidateId,
            evidence: candidate.evidence,
            evidenceRef: candidate.evidence.map((item) => item.ref).join("+"),
            sourceRef: candidate.sourceRef,
            observedAt: candidate.observedAt,
            measuredResult: candidate.measuredResult,
            traceId,
            promotedBy: securityContext.actor?.id ?? "unknown-actor",
            governanceDecision: governance.decision,
            supersededVersion: previous?.version ?? null,
            divergences: Object.freeze(divergences),
            provenance: Object.freeze({
                createdAt: now,
                updatedAt: now,
                createdByTraceId: traceId,
                updatedByTraceId: traceId,
                inputHash: ProvenanceTrace.hashInput(`${candidate.candidateId}|${candidate.statement}|${version}`),
                outputHash: ProvenanceTrace.hashInput(`${candidate.statement}|${version}|${governance.outputHash}`),
            }),
        });

        if (previous) await this.writeArtifact({ ...previous, validity: "SUPERSEDED", provenance: { ...previous.provenance, updatedAt: now, updatedByTraceId: traceId } });
        await this.writeArtifact(artifact);
        await this.writeLedger(tenantId, candidate.subject, {
            tenantId,
            subject: candidate.subject,
            versions: Object.freeze([...ledger.versions, version]),
            activeVersion: version,
        });
        return artifact;
    }

    /**
     * CONTROLLED_RETRIEVAL. Returns only this tenant's currently active promoted
     * artifacts. A superseded or unpromoted version is never returned as active.
     */
    async retrieve(input: RetrieveInput): Promise<LearningArtifact[]> {
        return this.retrieveActiveSync(input?.tenantId, input?.subject);
    }

    /**
     * CONTROLLED_RETRIEVAL — synchronous face of the SAME retrieval, for the
     * synchronous canonical consumer (`CognitiveOrchestrationService.orchestrate`).
     *
     * This is not a second retrieval path and not a second authority: it is the
     * single retrieval implementation, expressed synchronously over the canonical
     * `SQLitePersistenceStore` connection. It applies exactly the same rules —
     * blank tenant fails closed, only the requesting tenant's records are read,
     * the record owner is re-verified, and only `ACTIVE` + `PROMOTED` artifacts
     * are returned, so a superseded version is never active context.
     */
    retrieveActiveSync(tenantId?: string, subject?: string): LearningArtifact[] {
        const scope = requireScope(tenantId);
        const subjectFilter = requireText(subject);
        const subjects = subjectFilter ? [subjectFilter] : this.listSubjectsSync(scope);
        const active: LearningArtifact[] = [];
        for (const subjectText of subjects) {
            const ledger = this.readLedgerSync(scope, subjectText);
            if (ledger.activeVersion === null) continue;
            const artifact = this.readArtifactByVersionSync(scope, subjectText, ledger.activeVersion);
            if (artifact && artifact.validity === "ACTIVE" && artifact.promotionState === "PROMOTED") active.push(artifact);
        }
        return active;
    }

    /** Synchronous ledger read for the same subject/version bookkeeping. */
    readLedgerSync(tenantId: string, subject: string): SubjectLedger {
        const scope = requireScope(tenantId);
        const value = this.syncRead<Partial<SubjectLedger>>(scope, ledgerKey(scope, subject));
        const versions = Array.isArray(value?.versions)
            ? value.versions.filter((entry): entry is number => Number.isInteger(entry) && entry > 0)
            : [];
        const activeVersion = Number.isInteger(value?.activeVersion) ? (value?.activeVersion as number) : null;
        return { tenantId: scope, subject, versions, activeVersion };
    }

    /**
     * Explicit version/reference retrieval. A superseded version stays
     * retrievable here; this is what makes rollback possible without data loss.
     */
    async retrieveVersion(tenantId: string, subject: string, version: number): Promise<LearningArtifact | null> {
        const scope = requireScope(tenantId);
        return this.retrieveVersionSync(scope, subject, version);
    }

    /** Synchronous explicit-version retrieval; a superseded version stays reachable. */
    retrieveVersionSync(tenantId: string, subject: string, version: number): LearningArtifact | null {
        const scope = requireScope(tenantId);
        const subjectText = requireText(subject);
        if (!subjectText) throw new Error("learning-subject-required");
        if (!Number.isInteger(version) || version <= 0) throw new Error("learning-version-invalid");
        return this.readArtifactByVersionSync(scope, subjectText, version);
    }

    /** Every persisted version of a subject, newest first, regardless of validity. */
    async versionHistory(tenantId: string, subject: string): Promise<LearningArtifact[]> {
        return this.versionHistorySync(tenantId, subject);
    }

    /** Synchronous version history; nothing is ever deleted, so every version is listed. */
    versionHistorySync(tenantId: string, subject: string): LearningArtifact[] {
        const scope = requireScope(tenantId);
        const subjectText = requireText(subject);
        if (!subjectText) throw new Error("learning-subject-required");
        const ledger = this.readLedgerSync(scope, subjectText);
        const artifacts: LearningArtifact[] = [];
        for (const version of [...ledger.versions].sort((a, b) => b - a)) {
            const artifact = this.readArtifactByVersionSync(scope, subjectText, version);
            if (artifact) artifacts.push(artifact);
        }
        return artifacts;
    }

    /**
     * ROLLBACK. Explicit and auditable: the chosen existing version becomes
     * ACTIVE again and the previously active version becomes SUPERSEDED. Both
     * remain persisted, and the rollback itself is a governed action.
     */
    async rollback(input: RollbackInput): Promise<LearningArtifact> {
        const tenantId = requireScope(input?.tenantId);
        const subject = requireText(input?.subject);
        if (!subject) throw new Error("learning-subject-required");
        const traceId = requireText(input?.traceId) || ProvenanceTrace.createTraceId();
        const target = await this.readArtifactByVersion(tenantId, subject, input.version);
        if (!target) throw new LearningRecordNotFoundError("artifact", `${subject}@v${input.version}`);

        const securityContext = input?.securityContext;
        if (!securityContext) throw new Error("learning-security-context-required: rollback requires a real security context");
        const governance = this.governance.evaluate({
            action: "CREATE_RESOURCE",
            securityContext,
            target: { tenantId },
            parameters: { capabilityId: "product.governed-learning", kind: "learning-artifact-rollback", subject, version: input.version },
            traceId,
        });
        if (governance.status !== "ALLOWED") {
            throw new LearningGovernanceDeniedError(target.artifactId, governance.status, governance.reasons.join("; ") || governance.decision);
        }

        const ledger = await this.readLedger(tenantId, subject);
        const now = new Date(this.now()).toISOString();
        const current = ledger.activeVersion === null ? null : await this.readArtifactByVersion(tenantId, subject, ledger.activeVersion);
        if (current && current.version !== target.version) {
            await this.writeArtifact({ ...current, validity: "SUPERSEDED", provenance: { ...current.provenance, updatedAt: now, updatedByTraceId: traceId } });
        }
        const restored: LearningArtifact = Object.freeze({
            ...target,
            validity: "ACTIVE" as LearningValidity,
            provenance: Object.freeze({
                ...target.provenance,
                updatedAt: now,
                updatedByTraceId: traceId,
                outputHash: ProvenanceTrace.hashInput(`${target.statement}|${target.version}|${governance.outputHash}`),
            }),
        });
        await this.writeArtifact(restored);
        await this.writeLedger(tenantId, subject, { ...ledger, activeVersion: target.version });
        return restored;
    }

    /** Provenance/version state of a subject without retrieving the body. */
    async inspect(tenantId: string, subject: string): Promise<LearningArtifactState[]> {
        return this.versionHistorySync(tenantId, subject).map((artifact) => Object.freeze({
            artifactId: artifact.artifactId,
            subject: artifact.subject,
            version: artifact.version,
            validity: artifact.validity,
            promotionState: artifact.promotionState,
            validationState: artifact.validationState,
            observedAt: artifact.observedAt,
            createdAt: artifact.provenance.createdAt,
            updatedAt: artifact.provenance.updatedAt,
        }));
    }

    /** Lifecycle state of a single candidate, for explainability. */
    async inspectCandidate(tenantId: string, candidateRef: string): Promise<LearningCandidate | null> {
        const scope = requireScope(tenantId);
        const candidate = await this.readCandidate(scope, requireText(candidateRef));
        return candidate;
    }

    // ---- internal, tenant-scoped persistence helpers -----------------------

    private async readCandidate(tenantId: string, candidateRef: string): Promise<LearningCandidate> {
        const candidate = await this.readOwned(tenantId, CANDIDATE_PREFIX, candidateRef, "candidate") as LearningCandidate | null;
        if (!candidate) throw new LearningRecordNotFoundError("candidate", candidateRef);
        return candidate;
    }

    /**
     * Reads by exact reference and re-verifies the record's own owner. The
     * persistence store is already tenant-keyed; this second check makes a
     * cross-tenant access fail closed even if a record were written with a
     * contradicting tenant.
     */
    private async readOwned(tenantId: string, prefix: string, reference: string, kind: "observation" | "candidate"): Promise<LearningObservation | LearningCandidate | null> {
        if (!reference) return null;
        const record = await this.persistence.read({ tenantId }, `${prefix}${tenantId}:${reference}`);
        const value = record?.value as { readonly tenantId?: string } | undefined;
        if (!value) return null;
        if (normalizeScope(value.tenantId) !== tenantId) {
            throw new LearningTenantConflictError(tenantId, normalizeScope(value.tenantId) || "<none>");
        }
        void kind;
        return value as LearningObservation | LearningCandidate;
    }

    private async readArtifactByVersion(tenantId: string, subject: string, version: number): Promise<LearningArtifact | null> {
        return this.readArtifactByVersionSync(tenantId, subject, version);
    }

    /**
     * Synchronous read of one artifact, re-verifying the record's own owner.
     * Same tenant discipline as the asynchronous reads; a contradicting owner
     * fails closed instead of returning the record.
     */
    private readArtifactByVersionSync(tenantId: string, subject: string, version: number): LearningArtifact | null {
        const value = this.syncRead<LearningArtifact>(tenantId, artifactKey(tenantId, subject, version));
        return value ?? null;
    }

    /**
     * Single synchronous read primitive over the canonical persistence
     * connection, with the same tenant scoping and owner re-verification the
     * asynchronous `SQLitePersistenceStore.read` path performs.
     */
    private syncRead<T>(tenantId: string, key: string): T | undefined {
        const scope = requireScope(tenantId);
        if (!requireText(key)) return undefined;
        const row = this.persistence.database
            .prepare("SELECT tenant_id, value_json FROM persistence_records WHERE tenant_id = ? AND key = ?")
            .get(scope, key) as { tenant_id?: string; value_json?: string } | undefined;
        if (!row?.tenant_id || typeof row.value_json !== "string") return undefined;
        let value: unknown;
        try {
            value = JSON.parse(row.value_json) as unknown;
        } catch {
            return undefined;
        }
        const owner = (value as { readonly tenantId?: string } | null)?.tenantId;
        if (normalizeScope(owner) !== scope) {
            throw new LearningTenantConflictError(scope, normalizeScope(owner) || "<none>");
        }
        return value as T;
    }

    private async writeArtifact(artifact: LearningArtifact): Promise<void> {
        await this.persistence.write({ tenantId: artifact.tenantId }, artifactKey(artifact.tenantId, artifact.subject, artifact.version), artifact);
    }

    private async readLedger(tenantId: string, subject: string): Promise<SubjectLedger> {
        return this.readLedgerSync(tenantId, subject);
    }

    private async writeLedger(tenantId: string, subject: string, ledger: SubjectLedger): Promise<void> {
        await this.persistence.write({ tenantId }, ledgerKey(tenantId, subject), ledger);
    }

    /**
     * Subjects known to this tenant. Discovered from the artifacts this tenant
     * actually owns rather than from any unscoped global list.
     */
    private listSubjectsSync(tenantId: string): string[] {
        const subjects = new Set<string>();
        for (const artifact of this.scanArtifactsSync(tenantId)) subjects.add(artifact.subject);
        return [...subjects];
    }

    private scanArtifactsSync(tenantId: string): LearningArtifact[] {
        const scope = requireScope(tenantId);
        const rows = this.persistence.database
            .prepare("SELECT key, value_json FROM persistence_records WHERE tenant_id = ? AND key LIKE ?")
            .all(scope, `${ARTIFACT_PREFIX}${scope}:%`) as { key?: string; value_json?: string }[];
        const artifacts: LearningArtifact[] = [];
        for (const row of rows) {
            if (!row.key || typeof row.value_json !== "string") continue;
            try {
                const value = JSON.parse(row.value_json) as LearningArtifact;
                if (normalizeScope(value?.tenantId) === scope) artifacts.push(value);
            } catch {
                // A corrupt row is never silently treated as a learning artifact.
            }
        }
        return artifacts;
    }
}
